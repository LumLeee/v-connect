from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.participations.models import Participation
from apps.participations.tests.test_api import fixtures
from ..models import Activity


class DiscoveryTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.open = fixtures()
        self.now = timezone.now()
        self.url = '/api/v1/activities/'

    def activity(self, **changes):
        values = dict(organizer=self.owner, title='Khám phá', description='Mô tả', address='Huế', capacity=2,
                      starts_at=self.now+timedelta(days=3), ends_at=self.now+timedelta(days=3, hours=1),
                      status='published', published_at=self.now)
        values.update(changes)
        return Activity.objects.create(**values)

    def participation(self, activity, status='approved'):
        return Participation.objects.create(activity=activity, volunteer=self.one, status=status,
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)

    def test_guest_and_authenticated_discovery_hide_closed_and_full_activities(self):
        ongoing = self.activity(starts_at=self.now-timedelta(hours=1), ends_at=self.now+timedelta(hours=1))
        self.activity(starts_at=self.now-timedelta(hours=2), ends_at=self.now-timedelta(hours=1))
        full = self.activity(capacity=1)
        self.participation(full)
        for status in ['draft', 'cancelled', 'completed']:
            self.activity(status=status)
        self.activity(published_at=None)
        for user in [None, self.one, self.owner]:
            client = APIClient()
            if user:
                client.force_login(user)
            response = client.get(self.url + '?page_size=1&location=Huế')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['count'], 1)
            self.assertEqual(response.data['results'][0]['id'], str(self.open.pk))
            self.assertIn('no-store', response['Cache-Control'])
            # Existing participants can still open published detail pages.
            self.assertEqual(client.get(f'{self.url}{ongoing.pk}/').status_code, 200)
            self.assertEqual(client.get(f'{self.url}{full.pk}/').status_code, 200)

    def test_exact_deadline_and_capacity_release_are_rechecked(self):
        self.participation(self.open, status='pending')
        self.assertEqual(self.client.get(self.url).data['count'], 1)
        Participation.objects.filter(activity=self.open).update(status='approved')
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        Participation.objects.filter(activity=self.open).update(status='cancelled')
        self.assertEqual(self.client.get(self.url).data['count'], 1)
        with patch('apps.activities.views.timezone.now', return_value=self.open.starts_at):
            self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.client.force_login(self.owner)
        with patch('apps.activities.views.timezone.now', return_value=self.open.ends_at):
            self.assertEqual(self.client.get('/api/v1/organizer/activities/').data['count'], 1)

    def test_public_list_queries_do_not_grow_with_the_number_of_activities(self):
        first = self.activity(title='Query budget activity', capacity=3)
        self.participation(first)
        Participation.objects.create(activity=first, volunteer=self.two, status='pending',
            registered_starts_at=first.starts_at, registered_ends_at=first.ends_at, registered_address=first.address)
        params = {'search': 'Query budget activity', 'page_size': 20}
        with CaptureQueriesContext(connection) as one_row:
            response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['results'][0]['approved_count'], 1)

        for _ in range(19):
            self.activity(title='Query budget activity')
        with CaptureQueriesContext(connection) as twenty_rows:
            response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['results']), 20)
        self.assertEqual(len(twenty_rows), len(one_row))
        counts = {item['id']: item['approved_count'] for item in response.data['results']}
        self.assertEqual(counts.pop(str(first.pk)), 1)
        self.assertEqual(set(counts.values()), {0})
        detail = self.client.get(f'{self.url}{first.pk}/')
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['approved_count'], 1)

    def test_activity_payload_includes_organizer_active_state(self):
        for active in [True, False]:
            self.owner.is_active = active
            self.owner.save(update_fields=['is_active'])
            response = self.client.get(f'{self.url}{self.open.pk}/')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['organizer_active'], active)

    def test_search_results_use_stable_start_time_order_across_pages(self):
        activities = []
        for days in [4, 2, 3, 2, 5]:
            start = self.now + timedelta(days=days)
            activities.append(self.activity(title='Stable discovery ordering', starts_at=start, ends_at=start + timedelta(hours=1)))
        expected = [str(item.pk) for item in sorted(activities, key=lambda item: (item.starts_at, item.pk))]
        observed = []
        for page in [1, 2, 3]:
            response = self.client.get(self.url, {'search': 'Stable discovery ordering', 'location': 'Huế', 'page_size': 2, 'page': page})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['count'], 5)
            observed.extend(item['id'] for item in response.data['results'])
        self.assertEqual(observed, expected)
        repeated = self.client.get(self.url, {'search': 'Stable discovery ordering', 'location': 'Huế', 'page_size': 2, 'page': 2})
        self.assertEqual([item['id'] for item in repeated.data['results']], expected[2:4])
