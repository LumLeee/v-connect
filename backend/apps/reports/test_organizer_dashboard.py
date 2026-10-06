from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Participation


class OrganizerDashboardTests(APITestCase):
    url = '/api/v1/reports/organizer-dashboard/'

    def setUp(self):
        self.now = timezone.now()
        self.owner = User.objects.create_user('dashboard@example.invalid', role='organizer', full_name='Organizer')
        self.other = User.objects.create_user('other@example.invalid', role='organizer', full_name='Other')
        self.volunteer = User.objects.create_user('volunteer@example.invalid', role='volunteer', full_name='Volunteer')
        self.client.force_login(self.owner)

    def activity(self, offset, status='published', owner=None):
        return Activity.objects.create(organizer=owner or self.owner, title=f'Activity {offset}',
            description='Description', address='Hue', capacity=10, status=status,
            starts_at=self.now + timedelta(hours=offset), ends_at=self.now + timedelta(hours=offset + 2))

    def entry(self, activity, status='pending'):
        return Participation.objects.create(activity=activity, volunteer=self.volunteer, status=status,
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at,
            registered_address=activity.address)

    def test_scope_order_limits_counts_and_actionable_pending(self):
        future = [self.activity(offset) for offset in range(6, 0, -1)]
        for activity in future:
            self.entry(activity)
        current = self.activity(-1)
        self.entry(current, 'approved')
        expired = self.activity(-3)
        self.entry(expired)
        self.activity(-4, 'completed')
        draft = self.activity(8, 'draft')
        self.entry(draft)
        cancelled = self.activity(9, 'cancelled')
        self.entry(cancelled)
        self.entry(self.activity(1, owner=self.other))
        with patch('django.utils.timezone.now', return_value=self.now):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['activity_counts'], {'total': 11, 'completed': 1, 'draft': 1})
        self.assertEqual(data['upcoming_count'], 6)
        self.assertEqual([row['id'] for row in data['upcoming']], [str(a.pk) for a in reversed(future[2:])])
        self.assertEqual(data['ongoing_count'], 1)
        self.assertEqual(data['ongoing'][0]['approved_count'], 1)
        self.assertEqual(data['pending_count'], 6)
        self.assertEqual(len(data['pending']), 4)
        self.assertEqual(data['pending'][0]['activity_id'], str(future[-1].pk))
        self.assertEqual(data['metrics']['pending'], 9)
        self.assertNotIn('volunteer_email', data['pending'][0])
        self.assertIn('no-store', response['Cache-Control'])

    def test_start_and_end_boundaries(self):
        starting = self.activity(0)
        ending = self.activity(-2)
        self.entry(starting)
        with patch('django.utils.timezone.now', return_value=self.now):
            data = self.client.get(self.url).data
        self.assertEqual({row['id'] for row in data['ongoing']}, {str(starting.pk), str(ending.pk)})
        self.assertEqual(data['pending_count'], 0)
        self.assertEqual(data['upcoming_count'], 0)

    def test_empty_and_role_permissions(self):
        data = self.client.get(self.url).data
        self.assertEqual(data['activity_counts']['total'], 0)
        self.assertEqual(data['pending'], [])
        self.assertEqual(data['ongoing'], [])
        self.assertEqual(data['upcoming'], [])
        for user in [self.volunteer, User.objects.create_user(username='dashboard-admin', role='admin', full_name='Admin')]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)
