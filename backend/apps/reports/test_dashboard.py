from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.activities.models import Activity
from apps.feedback.tests import fixtures
from apps.participations.models import Participation


class VolunteerDashboardTests(APITestCase):
    url = '/api/v1/reports/volunteer-dashboard/'

    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, self.attendances = fixtures()
        self.now = timezone.now()
        self.client.force_login(self.one)

    def add_entry(self, hours, status='approved', activity_status='published', volunteer=None):
        activity = Activity.objects.create(organizer=self.owner, title=f'Hoạt động {hours}',
            description='Cộng đồng', address='Huế', capacity=10, status=activity_status,
            starts_at=self.now + timedelta(hours=hours), ends_at=self.now + timedelta(hours=hours + 1),
            published_at=self.now - timedelta(days=1))
        return Participation.objects.create(activity=activity, volunteer=volunteer or self.one, status=status,
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)

    def test_upcoming_is_approved_future_public_scoped_sorted_and_bounded(self):
        expected = [self.add_entry(hours) for hours in [4, 2, 3, 1]]
        self.add_entry(1, status='pending')
        self.add_entry(1, status='rejected')
        self.add_entry(1, activity_status='cancelled')
        self.add_entry(1, volunteer=self.two)
        self.add_entry(0)
        with patch('apps.reports.views.timezone.now', return_value=self.now):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['upcoming_count'], 4)
        self.assertEqual([str(row['id']) for row in response.data['upcoming']],
                         [str(expected[i].pk) for i in [3, 1, 2]])
        self.assertEqual(len(response.data['history']), 1)
        self.assertEqual(str(response.data['history'][0]['id']), str(self.attendances[0].participation_id))
        self.assertEqual(response.data['metrics']['attended_completed'], 1)
        self.assertEqual(response.data['profile']['email'], self.one.email)
        self.assertEqual(response.data['member_since'], self.one.date_joined)
        self.assertNotIn('password', response.data['profile'])

    def test_empty_state_and_other_roles_cannot_read_dashboard(self):
        for user in [self.owner, self.admin]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_login(self.two)
        response = self.client.get(self.url)
        self.assertEqual(response.data['upcoming_count'], 0)
        self.assertEqual(response.data['upcoming'], [])
        self.assertEqual(response.data['metrics']['registered'], 1)
