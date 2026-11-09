from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Attendance, Participation
from .. import services
from ..models import Feedback
from .test_api import fixtures


class OrganizerFeedbackFilterTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, _ = fixtures()
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/feedback/'
        self.rows = []
        for index, rating in enumerate([5, 1, 5, 3, 2]):
            entry = self.make_feedback(self.activity, f'rating-{index}', rating)
            Feedback.objects.filter(pk=entry.pk).update(created_at=timezone.now() - timedelta(days=10 - index))
            self.rows.append(entry)
        self.hidden = self.make_feedback(self.activity, 'hidden', 5)
        services.hide(self.hidden.pk, self.admin, 'Không phù hợp')
        other_owner = User.objects.create_user('filter.other@example.invalid', role='organizer', full_name='Khác')
        self.other_activity = Activity.objects.create(organizer=other_owner, title='Hoạt động khác',
            description='Khác', address='Huế', capacity=20, status='completed', published_at=self.activity.published_at,
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at)
        self.other = self.make_feedback(self.other_activity, 'other-activity', 5)
        self.client.force_login(self.owner)

    def make_feedback(self, activity, suffix, rating):
        volunteer = User.objects.create_user(f'feedback.{suffix}@example.invalid', full_name=suffix)
        participation = Participation.objects.create(activity=activity, volunteer=volunteer, status='approved',
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at,
            registered_address=activity.address)
        attendance = Attendance.objects.create(participation=participation, confirmed_by=activity.organizer)
        return Feedback.objects.create(attendance=attendance, rating=rating, content=f'Phản hồi {suffix}')

    def test_star_filter_applies_before_pagination_and_summary_covers_the_whole_activity(self):
        first = self.client.get(self.url, {'rating': '5', 'page_size': 1}).data
        second = self.client.get(self.url, {'rating': '5', 'page_size': 1, 'page': 2}).data
        self.assertEqual(first['count'], 2)
        self.assertEqual(second['count'], 2)
        self.assertEqual(first['summary'], {'count': 5, 'average_rating': 3.2})
        self.assertEqual(second['summary'], first['summary'])
        self.assertEqual(first['results'][0]['id'], str(self.rows[2].pk))
        self.assertEqual(second['results'][0]['id'], str(self.rows[0].pk))
        self.assertIsNotNone(first['next'])
        self.assertIsNone(second['next'])
        self.assertNotIn(str(self.hidden.pk), str(first))
        self.assertNotIn(str(self.other.pk), str(first))

    def test_newest_default_and_oldest_are_deterministic(self):
        newest = self.client.get(self.url).data['results']
        oldest = self.client.get(self.url, {'ordering': 'oldest'}).data['results']
        self.assertEqual([row['id'] for row in newest], [str(entry.pk) for entry in reversed(self.rows)])
        self.assertEqual([row['id'] for row in oldest], [str(entry.pk) for entry in self.rows])
        same_time = timezone.now() - timedelta(days=2)
        Feedback.objects.filter(pk__in=[entry.pk for entry in self.rows]).update(created_at=same_time)
        stable = self.client.get(self.url, {'ordering': 'oldest', 'page_size': 2}).data['results']
        self.assertEqual([row['id'] for row in stable], sorted(str(entry.pk) for entry in self.rows)[:2])

    def test_invalid_filters_are_rejected_and_empty_filtered_list_retains_summary(self):
        for value in ['0', '6', '2.5', '', 'bad', '05']:
            with self.subTest(rating=value):
                self.assertEqual(self.client.get(self.url, {'rating': value}).status_code, 400)
        for value in ['-created_at', '', 'bad']:
            with self.subTest(ordering=value):
                self.assertEqual(self.client.get(self.url, {'ordering': value}).status_code, 400)
        response = self.client.get(self.url, {'rating': '4'})
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])
        self.assertEqual(response.data['summary'], {'count': 5, 'average_rating': 3.2})
        self.assertIn('no-store', response['Cache-Control'])

    def test_filters_preserve_owner_scope_and_role_permissions(self):
        self.assertEqual(self.client.get(f'/api/v1/organizer/activities/{self.other_activity.pk}/feedback/?rating=5').status_code, 404)
        for user in [self.one, self.admin]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url, {'rating': '5'}).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_organizer_still_cannot_hide_feedback(self):
        response = self.client.post(f'/api/v1/admin/feedback/{self.rows[0].pk}/hide/', {'reason': 'Lý do'})
        self.assertEqual(response.status_code, 403)
        self.rows[0].refresh_from_db()
        self.assertFalse(self.rows[0].is_hidden)
