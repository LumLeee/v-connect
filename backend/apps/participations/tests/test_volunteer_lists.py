from datetime import datetime, timedelta, timezone as datetime_timezone
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.feedback.models import Feedback
from ..models import Attendance, Contribution, Participation


class VolunteerListTests(APITestCase):
    registrations_url = '/api/v1/participations/'
    check_in_url = '/api/v1/participations/check-in/'
    history_url = '/api/v1/participations/history/'

    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('lists.org@example.invalid', role='organizer', full_name='Organizer')
        self.one = User.objects.create_user('lists.one@example.invalid', full_name='First volunteer')
        self.two = User.objects.create_user('lists.two@example.invalid', full_name='Second volunteer')
        self.now = timezone.now()
        self.client.force_authenticate(self.one)

    def entry(self, status='approved', activity_status='published', volunteer=None, attended=False,
              starts_at=None, ends_at=None, published=True):
        activity = Activity.objects.create(
            organizer=self.owner, title='Volunteer activity', description='Description', address='Address',
            starts_at=starts_at or self.now - timedelta(hours=1),
            ends_at=ends_at or self.now + timedelta(hours=1), capacity=10,
            status=activity_status, published_at=self.now - timedelta(days=2) if published else None,
        )
        entry = Participation.objects.create(
            activity=activity, volunteer=volunteer or self.one, status=status,
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at,
            registered_address=activity.address,
        )
        if attended:
            Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        return entry

    def test_registrations_keep_all_own_statuses_and_summary_ignores_page_size(self):
        own = [self.entry(status=status) for status in ['pending', 'approved', 'approved', 'rejected', 'cancelled']]
        foreign = self.entry(status='pending', volunteer=self.two)
        response = self.client.get(self.registrations_url, {'page_size': 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 5)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])
        self.assertEqual(response.data['summary'], {
            'total': 5, 'pending': 1, 'approved': 2, 'rejected': 1, 'cancelled': 1,
        })
        rows = self.client.get(self.registrations_url).data['results']
        self.assertCountEqual([row['id'] for row in rows], [str(entry.pk) for entry in own])
        self.assertNotIn(str(foreign.pk), [row['id'] for row in rows])
        self.assertIn('no-store', response['Cache-Control'])

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_check_in_only_contains_approved_published_own_entries(self):
        upcoming = self.entry(starts_at=self.now + timedelta(days=1), ends_at=self.now + timedelta(days=1, hours=1))
        attended = self.entry(attended=True)
        expired = self.entry(starts_at=self.now - timedelta(days=2), ends_at=self.now - timedelta(days=1))
        for status in ['pending', 'rejected', 'cancelled']:
            self.entry(status=status)
        for status in ['draft', 'completed', 'cancelled']:
            self.entry(activity_status=status, attended=True)
        self.entry(published=False)
        self.entry(volunteer=self.two)
        response = self.client.get(self.check_in_url, {'page_size': 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary'], {
            'total': 3, 'attended': 1, 'pending': 2, 'open': 0, 'upcoming': 1, 'closed': 1,
        })
        rows = self.client.get(self.check_in_url).data['results']
        self.assertCountEqual([row['id'] for row in rows], [str(entry.pk) for entry in [upcoming, attended, expired]])
        self.assertFalse(next(row for row in rows if row['id'] == str(attended.pk))['can_check_in'])

    def test_registration_search_and_status_counts_precede_pagination(self):
        expected = []
        for status in ['pending', 'pending', 'approved', 'rejected', 'cancelled']:
            entry = self.entry(status=status)
            entry.activity.title = 'Beach cleanup'
            entry.activity.save(update_fields=['title'])
            expected.append(entry)
        self.entry(status='pending')
        foreign = self.entry(status='pending', volunteer=self.two)
        foreign.activity.title = 'Beach cleanup'
        foreign.activity.save(update_fields=['title'])
        summary = {'total': 5, 'pending': 2, 'approved': 1, 'rejected': 1, 'cancelled': 1}
        first = self.client.get(self.registrations_url, {'search': '  BEACH  ', 'status': ' pending ', 'page_size': 1})
        second = self.client.get(self.registrations_url, {'search': 'beach', 'status': 'pending', 'page_size': 1, 'page': 2})
        for response in [first, second]:
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['count'], 2)
            self.assertEqual(response.data['summary'], summary)
        self.assertCountEqual([first.data['results'][0]['id'], second.data['results'][0]['id']],
                              [str(entry.pk) for entry in expected[:2]])
        self.assertIsNotNone(first.data['next'])
        self.assertIsNotNone(second.data['previous'])
        for status in ['approved', 'rejected', 'cancelled']:
            response = self.client.get(self.registrations_url, {'search': 'beach', 'status': status})
            self.assertEqual(response.data['count'], 1)
            self.assertEqual(response.data['results'][0]['status'], status)
            self.assertEqual(response.data['summary'], summary)
        missing = self.client.get(self.registrations_url, {'search': self.owner.email})
        self.assertEqual(missing.data['count'], 0)
        self.assertTrue(all(value == 0 for value in missing.data['summary'].values()))

    def test_registration_filters_validate_without_changing_registration_contract(self):
        self.entry(attended=True)
        for query in [{'status': ''}, {'status': 'unknown'}, {'search': 'x' * 201}]:
            self.assertEqual(self.client.get(self.registrations_url, query).status_code, 400)
        self.assertEqual(self.client.get(self.registrations_url, {'status': ' all ', 'search': '   '}).data['count'], 1)
        self.assertEqual(self.client.get(self.registrations_url, {'search': ' ' + 'x' * 200 + ' '}).status_code, 200)

    def test_history_retains_cancelled_evidence_and_own_feedback_and_zero_score(self):
        zero = self.entry(activity_status='completed', attended=True)
        scored = self.entry(activity_status='completed', attended=True)
        cancelled = self.entry(status='cancelled', activity_status='cancelled', attended=True)
        pending = self.entry(attended=True)
        self.entry(activity_status='completed')
        foreign = self.entry(volunteer=self.two, activity_status='completed', attended=True)
        Contribution.objects.create(attendance=zero.attendance, score=0, confirmed_by=self.owner)
        Contribution.objects.create(attendance=scored.attendance, score=7, confirmed_by=self.owner)
        Contribution.objects.create(attendance=foreign.attendance, score=10, confirmed_by=self.owner)
        feedback = Feedback.objects.create(attendance=cancelled.attendance, rating=4, content='Own feedback')
        Feedback.objects.create(attendance=foreign.attendance, rating=5, content='Private foreign feedback')
        response = self.client.get(self.history_url, {'page_size': 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary'], {
            'total': 4, 'completed': 2, 'total_score': 7, 'feedback_count': 1, 'confirmed': 2, 'pending': 2,
            'feedback_pending': 3,
        })
        rows = {row['id']: row for row in self.client.get(self.history_url).data['results']}
        self.assertEqual(rows[str(zero.pk)]['contribution']['score'], 0)
        self.assertIsNone(rows[str(pending.pk)]['contribution'])
        self.assertEqual(rows[str(cancelled.pk)]['feedback']['id'], str(feedback.pk))
        self.assertEqual(rows[str(cancelled.pk)]['feedback']['content'], 'Own feedback')
        self.assertFalse(rows[str(cancelled.pk)]['can_submit_feedback'])
        self.assertNotIn(str(foreign.pk), rows)
        self.assertFalse(rows[str(zero.pk)]['can_cancel'])

    def test_hidden_feedback_still_belongs_to_its_author(self):
        entry = self.entry(activity_status='completed', attended=True)
        Feedback.objects.create(
            attendance=entry.attendance, rating=3, content='Own hidden feedback', is_hidden=True,
            hidden_by=self.owner, hidden_at=self.now, hidden_reason='Moderated',
        )
        row = self.client.get(self.history_url).data['results'][0]
        self.assertTrue(row['feedback']['is_hidden'])
        self.assertEqual(row['feedback']['content'], 'Own hidden feedback')
        self.assertFalse(row['can_submit_feedback'])
        self.client.force_authenticate(self.two)
        self.assertEqual(self.client.get(self.history_url).data['results'], [])

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_action_flags_follow_existing_time_and_state_policies(self):
        future = self.entry(starts_at=self.now + timedelta(days=1), ends_at=self.now + timedelta(days=1, hours=1))
        active = self.entry()
        expired = self.entry(starts_at=self.now - timedelta(days=2), ends_at=self.now - timedelta(days=1))
        completed = self.entry(activity_status='completed', attended=True,
                               starts_at=self.now - timedelta(days=2), ends_at=self.now - timedelta(days=1))
        unfinished = self.entry(activity_status='completed', attended=True)
        pending = self.entry(status='pending')
        cancelled = self.entry(status='cancelled', activity_status='completed', attended=True)
        with patch('django.utils.timezone.now', return_value=self.now):
            rows = {row['id']: row for row in self.client.get(self.registrations_url).data['results']}
        self.assertTrue(rows[str(future.pk)]['can_cancel'])
        self.assertFalse(rows[str(future.pk)]['can_check_in'])
        self.assertFalse(rows[str(active.pk)]['can_cancel'])
        self.assertTrue(rows[str(active.pk)]['can_check_in'])
        self.assertFalse(rows[str(expired.pk)]['can_cancel'])
        self.assertFalse(rows[str(expired.pk)]['can_check_in'])
        self.assertTrue(rows[str(completed.pk)]['can_submit_feedback'])
        self.assertFalse(rows[str(unfinished.pk)]['can_submit_feedback'])
        self.assertFalse(rows[str(cancelled.pk)]['can_submit_feedback'])
        self.assertFalse(rows[str(pending.pk)]['can_check_in'])

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False)
    def test_action_flags_respect_disabled_time_checks_without_bypassing_state(self):
        expired = self.entry(starts_at=self.now - timedelta(days=2), ends_at=self.now - timedelta(days=1))
        completed = self.entry(activity_status='completed', attended=True)
        cancelled = self.entry(activity_status='cancelled', attended=True, status='cancelled')
        pending = self.entry(status='pending')
        rows = {row['id']: row for row in self.client.get(self.registrations_url).data['results']}
        self.assertTrue(rows[str(expired.pk)]['can_cancel'])
        self.assertTrue(rows[str(expired.pk)]['can_check_in'])
        self.assertTrue(rows[str(completed.pk)]['can_submit_feedback'])
        self.assertFalse(rows[str(cancelled.pk)]['can_check_in'])
        self.assertFalse(rows[str(cancelled.pk)]['can_cancel'])
        self.assertFalse(rows[str(cancelled.pk)]['can_submit_feedback'])
        self.assertTrue(rows[str(pending.pk)]['can_cancel'])
        self.assertFalse(rows[str(pending.pk)]['can_check_in'])

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_summaries_and_rows_refresh_together_after_attendance_or_status_changes(self):
        entry = self.entry()
        self.assertEqual(self.client.get(self.check_in_url).data['summary'], {
            'total': 1, 'attended': 0, 'pending': 1, 'open': 1, 'upcoming': 0, 'closed': 0,
        })
        Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        response = self.client.get(self.check_in_url).data
        self.assertEqual(response['summary'], {
            'total': 1, 'attended': 1, 'pending': 0, 'open': 0, 'upcoming': 0, 'closed': 0,
        })
        self.assertIsNotNone(response['results'][0]['attendance'])
        Activity.objects.filter(pk=entry.activity_id).update(status='completed')
        self.assertEqual(self.client.get(self.check_in_url).data['count'], 0)
        self.assertEqual(self.client.get(self.history_url).data['summary']['completed'], 1)

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_check_in_filters_counts_and_priority_use_whole_searched_list(self):
        closed = self.entry(starts_at=self.now - timedelta(days=2), ends_at=self.now - timedelta(days=1))
        attended = self.entry(attended=True, starts_at=self.now - timedelta(days=3), ends_at=self.now - timedelta(days=2))
        upcoming = self.entry(starts_at=self.now + timedelta(days=1), ends_at=self.now + timedelta(days=1, hours=1))
        opened = [self.entry(), self.entry(starts_at=self.now - timedelta(minutes=30))]
        expected = [*opened, upcoming, attended, closed]
        Activity.objects.filter(pk__in=[entry.activity_id for entry in expected]).update(title='Beach cleanup')
        self.entry()
        self.entry(volunteer=self.two)
        summary = {'total': 5, 'pending': 4, 'attended': 1, 'open': 2, 'upcoming': 1, 'closed': 1}
        with patch('django.utils.timezone.now', return_value=self.now):
            all_rows = self.client.get(self.check_in_url, {'search': '  BEACH  '})
            self.assertEqual(all_rows.status_code, 200, all_rows.data)
            self.assertEqual(all_rows.data['summary'], summary)
            self.assertEqual([row['id'] for row in all_rows.data['results']], [str(entry.pk) for entry in expected])
            for page in [1, 2]:
                result = self.client.get(self.check_in_url, {'search': 'beach', 'status': ' open ', 'page_size': 1, 'page': page})
                self.assertEqual(result.data['count'], 2)
                self.assertEqual(result.data['summary'], summary)
                self.assertTrue(result.data['results'][0]['can_check_in'])
            for state, entry in [('upcoming', upcoming), ('attended', attended), ('closed', closed)]:
                result = self.client.get(self.check_in_url, {'search': 'beach', 'status': state})
                self.assertEqual(result.data['summary'], summary)
                self.assertEqual([row['id'] for row in result.data['results']], [str(entry.pk)])
            missing = self.client.get(self.check_in_url, {'search': 'missing'})
            self.assertEqual(missing.data['count'], 0)
            self.assertTrue(all(value == 0 for value in missing.data['summary'].values()))

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_check_in_open_includes_both_time_boundaries(self):
        self.entry(starts_at=self.now, ends_at=self.now + timedelta(hours=1))
        self.entry(starts_at=self.now - timedelta(hours=1), ends_at=self.now)
        with patch('django.utils.timezone.now', return_value=self.now):
            result = self.client.get(self.check_in_url, {'status': 'open'})
        self.assertEqual(result.data['count'], 2)
        self.assertEqual(result.data['summary']['open'], 2)
        self.assertEqual(result.data['next_transition_at'], (self.now + timedelta(milliseconds=1)).isoformat())

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
    def test_next_transition_includes_upcoming_outside_empty_status_page(self):
        upcoming = self.entry(starts_at=self.now + timedelta(minutes=5), ends_at=self.now + timedelta(hours=1))
        Activity.objects.filter(pk=upcoming.activity_id).update(title='Beach cleanup')
        self.entry(volunteer=self.two, starts_at=self.now + timedelta(seconds=1))
        self.entry(attended=True, starts_at=self.now + timedelta(seconds=2))
        with patch('django.utils.timezone.now', return_value=self.now):
            response = self.client.get(self.check_in_url, {'search': 'Beach', 'status': 'open'})
            self.assertEqual(response.data['count'], 0)
            self.assertEqual(response.data['summary']['upcoming'], 1)
            self.assertEqual(response.data['next_transition_at'], (self.now + timedelta(minutes=5)).isoformat())
            empty = self.client.get(self.check_in_url, {'search': 'missing'})
            self.assertIsNone(empty.data['next_transition_at'])

    @override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False)
    def test_demo_policy_classifies_all_unattended_as_open_and_keeps_attended_exclusive(self):
        self.entry(starts_at=self.now + timedelta(days=1), ends_at=self.now + timedelta(days=1, hours=1))
        self.entry(starts_at=self.now - timedelta(days=2), ends_at=self.now - timedelta(days=1))
        attended = self.entry(attended=True)
        result = self.client.get(self.check_in_url, {'status': 'open'})
        self.assertEqual(result.data['summary'], {
            'total': 3, 'pending': 2, 'attended': 1, 'open': 2, 'upcoming': 0, 'closed': 0,
        })
        self.assertEqual(result.data['count'], 2)
        self.assertNotIn(str(attended.pk), [row['id'] for row in result.data['results']])
        self.assertTrue(all(row['can_check_in'] for row in result.data['results']))
        self.assertIsNone(result.data['next_transition_at'])

    def test_history_date_search_feedback_counts_precede_feedback_and_pagination(self):
        def dated_entry(confirmed_at, **kwargs):
            entry = self.entry(attended=True, **kwargs)
            Activity.objects.filter(pk=entry.activity_id).update(title='Beach cleanup')
            Attendance.objects.filter(participation=entry).update(confirmed_at=confirmed_at)
            return entry

        lower = datetime(2026, 11, 5, 17, tzinfo=datetime_timezone.utc)
        upper = datetime(2026, 11, 6, 16, 59, 59, 999999, tzinfo=datetime_timezone.utc)
        early = dated_entry(lower, activity_status='completed')
        middle = dated_entry(lower + timedelta(hours=1), activity_status='completed')
        late = dated_entry(upper, activity_status='cancelled', status='cancelled')
        dated_entry(lower - timedelta(microseconds=1))
        dated_entry(upper + timedelta(microseconds=1))
        dated_entry(lower, volunteer=self.two)
        unrelated = self.entry(attended=True)
        Attendance.objects.filter(participation=unrelated).update(confirmed_at=lower)
        Contribution.objects.create(attendance=early.attendance, score=0, confirmed_by=self.owner)
        Contribution.objects.create(attendance=middle.attendance, score=7, confirmed_by=self.owner)
        Feedback.objects.create(attendance=early.attendance, rating=4, content='Submitted')
        Feedback.objects.create(attendance=late.attendance, rating=3, content='Hidden but submitted', is_hidden=True,
                                hidden_by=self.owner, hidden_at=self.now, hidden_reason='Moderated')
        query = {'search': '  BEACH ', 'date_from': '2026-11-06', 'date_to': '2026-11-06'}
        summary = {'total': 3, 'completed': 2, 'total_score': 7, 'feedback_count': 2,
                   'feedback_pending': 1, 'confirmed': 2, 'pending': 1}
        result = self.client.get(self.history_url, query)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['summary'], summary)
        self.assertEqual([row['id'] for row in result.data['results']], [str(entry.pk) for entry in [late, middle, early]])
        for page, expected in [(1, late), (2, early)]:
            result = self.client.get(self.history_url, {**query, 'feedback': ' submitted ', 'page_size': 1, 'page': page})
            self.assertEqual(result.data['count'], 2)
            self.assertEqual(result.data['summary'], summary)
            self.assertEqual(result.data['results'][0]['id'], str(expected.pk))
        pending = self.client.get(self.history_url, {**query, 'feedback': 'pending'})
        self.assertEqual(pending.data['summary'], summary)
        self.assertEqual([row['id'] for row in pending.data['results']], [str(middle.pk)])
        self.assertEqual(self.client.get(self.history_url, {**query, 'search': 'missing'}).data['summary']['total'], 0)

    def test_check_in_and_history_validate_filters(self):
        for url in [self.check_in_url, self.history_url]:
            self.assertEqual(self.client.get(url, {'search': 'x' * 201}).status_code, 400)
            self.assertEqual(self.client.get(url, {'search': ' ' + 'x' * 200 + ' '}).status_code, 200)
        for state in ['', 'unknown', 'approved']:
            self.assertEqual(self.client.get(self.check_in_url, {'status': state}).status_code, 400)
        for query in [
            {'feedback': ''}, {'feedback': 'unknown'}, {'date_from': '2026-02-30'},
            {'date_to': 'not-a-date'}, {'date_from': '20261106'},
            {'date_from': '0001-01-01'},
            {'date_from': '2026-11-07', 'date_to': '2026-11-06'},
        ]:
            with self.subTest(query=query):
                self.assertEqual(self.client.get(self.history_url, query).status_code, 400)
        self.assertEqual(self.client.get(self.history_url, {'feedback': ' all ', 'date_from': '', 'date_to': ''}).status_code, 200)

    def test_no_lists_or_private_summaries_for_anonymous_or_other_roles(self):
        self.entry(attended=True)
        admin = User.objects.create_user('lists.admin@example.invalid', username='lists.admin', role='admin', full_name='Admin')
        for user, expected in [(None, 401), (self.owner, 403), (admin, 403)]:
            self.client.force_authenticate(user)
            for url in [self.registrations_url, self.check_in_url, self.history_url]:
                with self.subTest(user=user, url=url):
                    self.assertEqual(self.client.get(url).status_code, expected)
        self.client.force_authenticate(self.two)
        for url in [self.registrations_url, self.check_in_url, self.history_url]:
            response = self.client.get(url)
            self.assertEqual(response.data['count'], 0)
            self.assertTrue(all(value == 0 for value in response.data['summary'].values()))

    def test_large_pages_do_not_query_feedback_contribution_or_activity_per_row(self):
        for score in range(8):
            entry = self.entry(activity_status='completed', attended=True)
            Contribution.objects.create(attendance=entry.attendance, score=score, confirmed_by=self.owner)
            Feedback.objects.create(attendance=entry.attendance, rating=4, content='Feedback')
        with CaptureQueriesContext(connection) as small_page:
            self.assertEqual(self.client.get(self.history_url, {'page_size': 1}).status_code, 200)
        with CaptureQueriesContext(connection) as full_page:
            self.assertEqual(self.client.get(self.history_url, {'page_size': 20}).status_code, 200)
        self.assertEqual(len(small_page), len(full_page))
        self.assertLessEqual(len(full_page), 8)
