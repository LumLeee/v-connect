"""Moderation drilldowns and AI must use the same activity and visibility scope."""
from uuid import uuid4
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from apps.activities.models import Activity
from apps.participations.models import Attendance, Participation
from ..models import Feedback
from .. import services
from .test_api import fixtures
from .test_ai import prototype_vectors


@override_settings(FEEDBACK_AI_ENABLED=True, MATCHING_AI_ENABLED=True)
class AdminFeedbackScopeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, records = fixtures()
        self.first = Feedback.objects.create(attendance=records[0], rating=5, content='Phối hợp thân thiện và ý nghĩa.')
        self.second = Feedback.objects.create(attendance=records[1], rating=1, content='Cần chuẩn bị dụng cụ tốt hơn.')
        self.other = Activity.objects.create(
            organizer=self.owner, title='Hoạt động khác', description='Một chương trình riêng.', address='Đà Nẵng',
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at, capacity=2,
            status='completed', published_at=self.activity.published_at,
        )
        participation = Participation.objects.create(
            activity=self.other, volunteer=self.one, status='approved',
            registered_starts_at=self.other.starts_at, registered_ends_at=self.other.ends_at,
            registered_address=self.other.address,
        )
        attendance = Attendance.objects.create(participation=participation, confirmed_by=self.owner)
        self.outside = Feedback.objects.create(attendance=attendance, rating=3, content='OUTSIDE_ACTIVITY_PRIVATE_TEXT')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.admin)
        self.url = '/api/v1/admin/feedback/'
        self.ai_url = self.url + 'ai-analysis/'

    def analyze(self, filters):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(self.ai_url, filters, format='json', HTTP_X_CSRFTOKEN=token)

    def test_activity_and_visibility_filter_count_all_pages_without_changing_global_list(self):
        services.hide(self.first.pk, self.admin, 'Đã đối chiếu nội dung.')
        self.assertEqual(self.client.get(self.url).data['count'], 3)
        filters = {'activity': str(self.activity.pk), 'page_size': 1}
        result = self.client.get(self.url, filters).data
        self.assertEqual(result['count'], 2)
        self.assertEqual(len(result['results']), 1)
        self.assertIsNotNone(result['next'])
        second_page = self.client.get(self.url, {**filters, 'page': 2}).data
        self.assertEqual(second_page['count'], 2)
        self.assertEqual({result['results'][0]['id'], second_page['results'][0]['id']},
                         {str(self.first.pk), str(self.second.pk)})
        for status, expected in [('visible', self.second), ('hidden', self.first)]:
            scoped = self.client.get(self.url, {**filters, 'status': status}).data
            self.assertEqual(scoped['count'], 1)
            self.assertEqual(scoped['results'][0]['id'], str(expected.pk))
            self.assertEqual(scoped['results'][0]['activity_id'], str(self.activity.pk))

    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_analysis_matches_activity_list_and_never_embeds_other_activity(self, embed):
        services.hide(self.first.pk, self.admin, 'Đã đối chiếu nội dung.')
        before = list(Feedback.objects.values())
        for status, expected in [('visible', self.second), ('hidden', self.first)]:
            filters = {'activity': str(self.activity.pk), 'status': status}
            response = self.analyze(filters)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['scope']['activity_id'], str(self.activity.pk))
            self.assertEqual(response.data['scope']['filters'], filters)
            self.assertEqual(response.data['scope']['feedback_count'], self.client.get(self.url, filters).data['count'])
            self.assertEqual(response.data['summary']['source_feedback_ids'], [str(expected.pk)])
            self.assertNotIn(self.outside.content, str(embed.call_args.args[0]))
            self.assertNotIn(self.outside.content, str(response.data))
            self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(before, list(Feedback.objects.values()))

    @patch('apps.feedback.ai.embed_texts')
    def test_invalid_or_missing_activity_fails_before_inference_instead_of_using_global_scope(self, embed):
        for activity, status in [('not-a-uuid', 400), ('', 400), (str(uuid4()), 404)]:
            filters = {'activity': activity, 'status': 'all'}
            self.assertEqual(self.client.get(self.url, filters).status_code, status)
            self.assertEqual(self.analyze(filters).status_code, status)
        self.assertEqual(self.analyze({'activity': str(self.activity.pk), 'status': 'wrong'}).status_code, 400)
        self.assertEqual(self.analyze({'activity': str(self.activity.pk), 'page': 2}).status_code, 400)
        embed.assert_not_called()

    @patch('apps.feedback.ai.embed_texts')
    def test_activity_filter_does_not_grant_other_roles_moderation_access_or_bypass_csrf(self, embed):
        filters = {'activity': str(self.activity.pk)}
        self.assertEqual(self.client.post(self.ai_url, filters, format='json').status_code, 403)
        for user in [self.owner, self.one]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url, filters).status_code, 403)
            self.assertEqual(self.analyze(filters).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url, filters).status_code, 401)
        self.assertEqual(self.analyze(filters).status_code, 401)
        embed.assert_not_called()
