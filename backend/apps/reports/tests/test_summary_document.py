from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.feedback.services import hide, submit
from apps.feedback.tests.test_api import fixtures
from apps.participations.models import Contribution


class SummaryDocumentTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, self.attendances = fixtures()
        Contribution.objects.create(attendance=self.attendances[0], score=8, confirmed_by=self.owner)
        self.url = f'/api/v1/reports/activities/{self.activity.pk}/summary-document/'
        self.client.force_login(self.owner)

    def test_summary_scores_pending_and_hidden_feedback(self):
        feedback = submit(self.activity.pk, self.one, {'rating': 5, 'content': 'Tốt'})
        hide(feedback.pk, self.admin, 'Kiểm tra')
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['contributions'], {'score': 8, 'confirmed': 1, 'pending': 1})
        self.assertEqual(response.data['metrics']['feedback']['count'], 0)
        self.assertNotIn('certificates', response.data)
        self.assertIn('no-store', response['Cache-Control'])
        Contribution.objects.create(attendance=self.attendances[1], score=0, confirmed_by=self.owner)
        self.assertEqual(self.client.get(self.url).data['contributions'], {'score': 8, 'confirmed': 2, 'pending': 0})

    def test_only_owner_or_admin_reads_completed_summary(self):
        other = User.objects.create_user('summary.other@example.invalid', role='organizer', full_name='Khác')
        for user, status in [(other, 404), (self.one, 403), (self.admin, 200)]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, status)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_requires_completed_and_ended_activity(self):
        for status in ['draft', 'published', 'cancelled']:
            self.activity.status = status
            self.activity.save(update_fields=['status'])
            self.assertEqual(self.client.get(self.url).status_code, 400)
        self.activity.status = 'completed'
        self.activity.ends_at = timezone.now() + timedelta(hours=1)
        self.activity.save()
        self.assertEqual(self.client.get(self.url).status_code, 400)

    def test_removed_endpoints_return_not_found_for_read_and_write(self):
        code = '00000000-0000-4000-8000-000000000000'
        for url in ['/api/v1/certificates/', f'/api/v1/certificates/{code}/',
                    f'/api/v1/certificates/{code}/verify/', f'/api/v1/certificates/{code}/revoke/',
                    f'/api/v1/reports/activities/{self.activity.pk}/certificate-candidates/',
                    f'/api/v1/reports/activities/{self.activity.pk}/certificates/']:
            self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(self.client.post(url, {}, format='json').status_code, 404)
