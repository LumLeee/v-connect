import uuid
from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from ..models import Participation


class ApplicantFilterTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            'applicants.org@example.invalid', role='organizer', full_name='Organizer',
        )
        self.other_owner = User.objects.create_user(
            'applicants.other@example.invalid', role='organizer', full_name='Other organizer',
        )
        self.now = timezone.now()
        self.activity = self.make_activity(self.owner)
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/applicants/'
        self.entries = []
        for index, (name, status, hours_ago) in enumerate([
            ('Lan Tran', 'approved', 6),
            ('Minh Nguyen', 'pending', 1),
            ('Nam Le', 'rejected', 5),
            ('Hoa Tran', 'pending', 4),
            ('Anh Pham', 'cancelled', 3),
            ('Hai Tran', 'approved', 6),
        ], start=1):
            volunteer = User.objects.create_user(f'applicant.{index}@example.invalid', full_name=name)
            entry = Participation.objects.create(
                id=uuid.UUID(int=index), activity=self.activity, volunteer=volunteer, status=status,
                registered_starts_at=self.activity.starts_at, registered_ends_at=self.activity.ends_at,
                registered_address=self.activity.address,
            )
            Participation.objects.filter(pk=entry.pk).update(registered_at=self.now - timedelta(hours=hours_ago))
            self.entries.append(entry)
        self.client.force_authenticate(self.owner)

    def make_activity(self, owner):
        return Activity.objects.create(
            organizer=owner, title='Applicant filtering', description='Description', address='Address',
            starts_at=self.now + timedelta(days=2), ends_at=self.now + timedelta(days=2, hours=2),
            capacity=20, status='published', published_at=self.now,
        )

    def row_ids(self, response):
        return [row['id'] for row in response.data['results']]

    def test_default_keeps_all_statuses_and_prioritizes_oldest_pending_then_stable_ids(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 6)
        self.assertEqual(self.row_ids(response), [str(self.entries[index].pk) for index in [3, 1, 0, 5, 2, 4]])
        self.assertEqual(response.data['summary'], {
            'total': 6, 'pending': 2, 'approved': 2, 'rejected': 1, 'cancelled': 1,
        })
        self.assertEqual(self.row_ids(response), self.row_ids(self.client.get(self.url, {'status': 'all'})))
        self.assertIn('no-store', response['Cache-Control'])
        self.assertNotIn('password', response.data['results'][0])

    def test_each_status_filters_rows_without_changing_summary(self):
        for status, expected_count in [('pending', 2), ('approved', 2), ('rejected', 1), ('cancelled', 1)]:
            with self.subTest(status=status):
                response = self.client.get(self.url, {'status': status})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['count'], expected_count)
                self.assertTrue(all(row['status'] == status for row in response.data['results']))
                self.assertEqual(response.data['summary']['total'], 6)
                self.assertEqual(response.data['summary']['pending'], 2)

    def test_name_and_email_searches_are_case_insensitive_and_trimmed(self):
        by_name = self.client.get(self.url, {'search': '  hOA tRaN  '})
        self.assertEqual(self.row_ids(by_name), [str(self.entries[3].pk)])
        by_email = self.client.get(self.url, {'search': ' APPLICANT.2@EXAMPLE.INVALID '})
        self.assertEqual(self.row_ids(by_email), [str(self.entries[1].pk)])
        self.assertEqual(by_email.data['summary'], {
            'total': 1, 'pending': 1, 'approved': 0, 'rejected': 0, 'cancelled': 0,
        })
        self.assertEqual(self.client.get(self.url, {'search': '   '}).data['count'], 6)

    def test_summary_covers_search_matches_before_status_and_pagination(self):
        params = {'search': 'Tran', 'status': 'approved', 'page_size': 1}
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['summary'], {
            'total': 3, 'pending': 1, 'approved': 2, 'rejected': 0, 'cancelled': 0,
        })
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])
        second = self.client.get(self.url, {**params, 'page': 2})
        self.assertEqual(second.data['summary'], response.data['summary'])
        self.assertEqual(second.data['count'], 2)
        self.assertEqual(self.row_ids(response) + self.row_ids(second), [str(self.entries[index].pk) for index in [0, 5]])
        self.assertIsNone(second.data['next'])
        self.assertIsNotNone(second.data['previous'])

    def test_empty_status_or_search_results_have_accurate_summary(self):
        no_status_match = self.client.get(self.url, {'search': 'Tran', 'status': 'cancelled'})
        self.assertEqual(no_status_match.data['results'], [])
        self.assertEqual(no_status_match.data['count'], 0)
        self.assertEqual(no_status_match.data['summary']['total'], 3)
        no_search_match = self.client.get(self.url, {'search': 'No such applicant'})
        self.assertEqual(no_search_match.data['count'], 0)
        self.assertEqual(no_search_match.data['results'], [])
        self.assertTrue(all(value == 0 for value in no_search_match.data['summary'].values()))

    def test_invalid_status_and_overlong_search_are_rejected(self):
        for status in ['unknown', '', 'APPROVED']:
            with self.subTest(status=status):
                response = self.client.get(self.url, {'status': status})
                self.assertEqual(response.status_code, 400)
                self.assertIn('status', response.data['error']['details'])
        response = self.client.get(self.url, {'search': 'x' * 201})
        self.assertEqual(response.status_code, 400)
        self.assertIn('search', response.data['error']['details'])
        self.assertEqual(self.client.get(self.url, {'search': f'  {"x" * 200}  '}).status_code, 200)

    def test_permissions_and_activity_ownership_apply_before_filter_validation(self):
        foreign = self.make_activity(self.other_owner)
        foreign_url = f'/api/v1/organizer/activities/{foreign.pk}/applicants/'
        missing_url = f'/api/v1/organizer/activities/{uuid.uuid4()}/applicants/'
        for url in [foreign_url, missing_url]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url, {'status': 'invalid', 'search': 'x' * 201}).status_code, 404)
        self.client.force_authenticate(self.other_owner)
        self.assertEqual(self.client.get(self.url, {'search': 'Tran'}).status_code, 404)
        self.client.force_authenticate(self.entries[0].volunteer)
        self.assertEqual(self.client.get(self.url, {'status': 'invalid'}).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_other_activities_do_not_affect_rows_or_summary(self):
        for activity in [self.make_activity(self.owner), self.make_activity(self.other_owner)]:
            Participation.objects.create(
                activity=activity, volunteer=self.entries[0].volunteer, status='pending',
                registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at,
                registered_address=activity.address,
            )
        response = self.client.get(self.url, {'status': 'pending'})
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['summary']['total'], 6)
        self.assertEqual(response.data['summary']['pending'], 2)

    def test_refresh_updates_status_rows_and_summary_in_the_same_response(self):
        before = self.client.get(self.url, {'status': 'pending'})
        self.assertEqual(before.data['count'], 2)
        Participation.objects.filter(pk=self.entries[3].pk).update(status='approved')
        after = self.client.get(self.url, {'status': 'pending'})
        self.assertEqual(after.data['count'], 1)
        self.assertEqual(self.row_ids(after), [str(self.entries[1].pk)])
        self.assertEqual(after.data['summary'], {
            'total': 6, 'pending': 1, 'approved': 3, 'rejected': 1, 'cancelled': 1,
        })

    def test_larger_pages_do_not_query_activity_or_its_details_per_row(self):
        with CaptureQueriesContext(connection) as small_page:
            response = self.client.get(self.url, {'page_size': 1})
            self.assertEqual(response.status_code, 200)
        with CaptureQueriesContext(connection) as full_page:
            response = self.client.get(self.url, {'page_size': 20})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data['results']), 6)
        self.assertEqual(len(small_page), len(full_page))
        self.assertLessEqual(len(full_page), 8)
