from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.feedback.models import Feedback
from apps.participations.models import Attendance, Contribution, Invitation, Participation
from ..models import Activity


@override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
class ManagementSummaryTests(APITestCase):
    url = '/api/v1/organizer/activities/'

    def setUp(self):
        cache.clear()
        self.now = timezone.now()
        self.counter = 0
        self.owner = User.objects.create_user('summary.org@example.invalid', role='organizer', full_name='Organizer')
        self.other = User.objects.create_user('summary.other@example.invalid', role='organizer', full_name='Other')
        self.admin = User.objects.create_superuser('summary.admin', full_name='Admin')
        self.complete = self.activity('Completed activity', 'completed')
        self.future = self.activity('Future activity', 'published')
        self.cancelled = self.activity('Cancelled activity', 'cancelled')
        first = self.entry(self.complete, attended=True, score=0)
        hidden = self.entry(self.complete, attended=True)
        self.entry(self.complete)
        self.entry(self.complete, status='pending')
        self.entry(self.future, attended=True, score=3)
        self.entry(self.future)
        self.entry(self.future, status='pending')
        cancelled = self.entry(self.cancelled, status='cancelled', attended=True, score=4)
        self.entry(self.cancelled, status='cancelled')
        Feedback.objects.create(attendance=first, rating=5, content='Helpful')
        Feedback.objects.create(attendance=hidden, rating=4, content='Hidden', is_hidden=True,
                                hidden_by=self.admin, hidden_at=self.now, hidden_reason='Moderated')
        Feedback.objects.create(attendance=cancelled, rating=5, content='Cancelled evidence')
        for activity in [self.future, self.future, self.cancelled]:
            Invitation.objects.create(activity=activity, volunteer=self.volunteer(), sent_by=self.owner,
                                      invited_starts_at=activity.starts_at, invited_ends_at=activity.ends_at,
                                      invited_address=activity.address)
        self.entry(self.activity('Foreign activity', 'completed', self.other), attended=True, score=10)
        self.client.force_authenticate(self.owner)

    def activity(self, title, status, owner=None):
        start = self.now + timedelta(days=2) if status == 'published' else self.now - timedelta(days=2)
        return Activity.objects.create(organizer=owner or self.owner, title=title, description='Community',
                                       address='Da Nang', status=status, capacity=10,
                                       starts_at=start, ends_at=start + timedelta(hours=2), published_at=self.now)

    def volunteer(self):
        self.counter += 1
        return User.objects.create_user(f'summary.{self.counter}@example.invalid', full_name=f'Volunteer {self.counter}')

    def entry(self, activity, status='approved', attended=False, score=None):
        entry = Participation.objects.create(activity=activity, volunteer=self.volunteer(), status=status,
                                             registered_starts_at=activity.starts_at,
                                             registered_ends_at=activity.ends_at, registered_address=activity.address)
        if attended:
            attendance = Attendance.objects.create(participation=entry, confirmed_by=activity.organizer)
            if score is not None:
                Contribution.objects.create(attendance=attendance, score=score, confirmed_by=activity.organizer)
            return attendance
        return entry

    def test_summary_covers_all_filtered_activities_before_pagination_without_join_multiplication(self):
        first = self.client.get(self.url, {'mode': 'attendance', 'page_size': 1})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['count'], 3)
        summary = first.data['summary']
        self.assertEqual(summary, {
            'activities': 3, 'registered': 9, 'pending': 2, 'approved': 5, 'attended': 4,
            'attendance_pending': 2, 'confirmed': 1, 'contribution_pending': 1,
            'feedback': 1, 'invitations': 3,
        })
        second = self.client.get(self.url, {'mode': 'attendance', 'page_size': 1, 'page': 2})
        self.assertEqual(second.data['summary'], summary)
        self.assertNotEqual(first.data['results'][0]['id'], second.data['results'][0]['id'])

    def test_contribution_eligibility_and_hidden_feedback_match_detail_lists(self):
        response = self.client.get(self.url, {'mode': 'contributions', 'status': 'completed'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['confirmed'], 1)
        self.assertEqual(response.data['summary']['contribution_pending'], 1)
        row = response.data['results'][0]
        self.assertEqual(row['contribution_count'], 1)
        self.assertEqual(row['contribution_pending_count'], 1)
        self.assertEqual(row['feedback_count'], 1)
        cancelled = self.client.get(self.url, {'mode': 'contributions', 'status': 'cancelled'}).data
        self.assertEqual(cancelled['summary']['confirmed'], 0)
        self.assertEqual(cancelled['summary']['contribution_pending'], 0)
        self.assertEqual(cancelled['results'][0]['attendance_count'], 1)
        self.assertEqual(cancelled['results'][0]['attendance_pending_count'], 0)

    def test_search_and_status_limit_summary_and_visible_feedback_activities(self):
        response = self.client.get(self.url, {'mode': 'feedback', 'search': 'Completed', 'status': 'completed'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['summary']['with_feedback'], 1)
        self.assertEqual(response.data['summary']['registered'], 4)
        self.assertEqual(response.data['summary']['feedback'], 1)
        empty = self.client.get(self.url, {'mode': 'feedback', 'search': 'Missing activity'})
        self.assertTrue(all(value == 0 for value in empty.data['summary'].values()))

    def test_matching_remaining_places_only_count_eligible_activities_and_obey_time_policy(self):
        response = self.client.get(self.url, {'mode': 'matching'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['remaining_places'], 8)
        Activity.objects.filter(pk=self.future.pk).update(starts_at=self.now - timedelta(hours=1))
        self.assertEqual(self.client.get(self.url, {'mode': 'matching'}).data['summary']['remaining_places'], 0)
        with override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False):
            self.assertEqual(self.client.get(self.url, {'mode': 'matching'}).data['summary']['remaining_places'], 8)

    def test_contribution_summary_respects_demo_time_policy(self):
        Activity.objects.filter(pk=self.complete.pk).update(ends_at=self.now + timedelta(days=1))
        response = self.client.get(self.url, {'mode': 'contributions', 'status': 'completed'})
        self.assertEqual(response.data['summary']['confirmed'], 0)
        self.assertEqual(response.data['summary']['contribution_pending'], 0)
        with override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False):
            response = self.client.get(self.url, {'mode': 'contributions', 'status': 'completed'})
            self.assertEqual(response.data['summary']['confirmed'], 1)
            self.assertEqual(response.data['summary']['contribution_pending'], 1)

    def test_permissions_scope_and_invalid_mode(self):
        self.assertEqual(self.client.get(self.url, {'mode': 'unknown'}).status_code, 400)
        self.client.force_authenticate(self.other)
        own = self.client.get(self.url, {'mode': 'contributions'})
        self.assertEqual(own.data['count'], 1)
        self.assertEqual(own.data['summary']['confirmed'], 1)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url, {'mode': 'feedback'}).status_code, 401)
