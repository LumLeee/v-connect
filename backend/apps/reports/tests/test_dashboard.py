from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.activities.models import Activity
from apps.feedback.tests.test_api import fixtures
from apps.participations.models import Attendance, Invitation, Participation


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

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_checkin_now_is_scoped_approved_public_unattended_and_bounded(self):
        expected = [self.add_entry(hours) for hours in [-1, -0.75, -0.5, 0]]
        self.add_entry(1)
        self.add_entry(-2)
        self.add_entry(-0.5, status='pending')
        self.add_entry(-0.5, activity_status='cancelled')
        self.add_entry(-0.5, volunteer=self.two)
        unpublished = self.add_entry(-0.5)
        Activity.objects.filter(pk=unpublished.activity_id).update(published_at=None)
        attended = self.add_entry(-0.5)
        Attendance.objects.create(participation=attended, confirmed_by=self.owner)
        with patch('apps.reports.views.timezone.now', return_value=self.now):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['checkin_now_count'], 4)
        self.assertEqual([row['id'] for row in response.data['checkin_now']], [str(entry.pk) for entry in expected[:3]])
        self.assertTrue(all(row['attendance'] is None for row in response.data['checkin_now']))

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False)
    def test_checkin_now_honors_demo_time_policy_but_keeps_state_and_recipient_checks(self):
        future = self.add_entry(48)
        expired = self.add_entry(-48)
        self.add_entry(48, status='pending')
        self.add_entry(48, activity_status='completed')
        self.add_entry(48, volunteer=self.two)
        response = self.client.get(self.url)
        self.assertEqual(response.data['checkin_now_count'], 2)
        self.assertEqual([row['id'] for row in response.data['checkin_now']], [str(expired.pk), str(future.pk)])

    def test_pending_summary_counts_all_own_records_without_changing_existing_metrics(self):
        pending = self.add_entry(24, status='pending')
        self.add_entry(48, status='pending')
        self.add_entry(24, status='pending', volunteer=self.two)
        for volunteer, status in [(self.one, 'pending'), (self.one, 'accepted'), (self.two, 'pending')]:
            entry = self.add_entry(24, volunteer=volunteer)
            Invitation.objects.create(
                activity=entry.activity, volunteer=volunteer, sent_by=self.owner, status=status,
                responded_at=None if status == 'pending' else self.now,
                invited_starts_at=entry.activity.starts_at, invited_ends_at=entry.activity.ends_at,
                invited_address=entry.activity.address,
            )
        # Pending remains pending even when the activity can no longer accept a response.
        Invitation.objects.create(
            activity=pending.activity, volunteer=self.one, sent_by=self.owner, status='pending',
            invited_starts_at=pending.activity.starts_at, invited_ends_at=pending.activity.ends_at,
            invited_address=pending.activity.address,
        )
        Activity.objects.filter(pk=pending.activity_id).update(status='cancelled')
        response = self.client.get(self.url)
        self.assertEqual(response.data['summary'], {'pending_registrations': 2, 'pending_invitations': 2})
        self.assertEqual(response.data['metrics']['pending'], 2)
        self.assertIn('upcoming_count', response.data)
        self.assertIn('history', response.data)
