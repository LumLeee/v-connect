from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from .models import Activity


class ActivityTests(APITestCase):
    url = '/api/v1/organizer/activities/'

    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('owner@example.invalid', 'River-Community-493!', full_name='Nhóm Xanh', role='organizer')
        self.other = User.objects.create_user('other@example.invalid', 'River-Community-493!', full_name='Khác', role='organizer')
        self.volunteer = User.objects.create_user('volunteer@example.invalid', 'River-Community-493!', full_name='An')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.start = timezone.now() + timedelta(days=2)
        self.payload = dict(title='Trồng cây 🌱', description='Cùng đóng góp', address='Đà Nẵng',
                            starts_at=self.start.isoformat(), ends_at=(self.start + timedelta(hours=2)).isoformat(), capacity=10)

    def mutate(self, method, url, data):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return getattr(self.client, method)(url, data, format='json', HTTP_X_CSRFTOKEN=token)

    def create(self):
        response = self.mutate('post', self.url, self.payload)
        self.assertEqual(response.status_code, 201, response.data)
        return Activity.objects.get(pk=response.data['id'])

    def change(self, activity, target):
        return self.mutate('post', f'{self.url}{activity.pk}/status/', {'status': target})

    def test_draft_private_and_publication_search_pagination(self):
        activity = self.create()
        guest = APIClient()
        detail = f'/api/v1/activities/{activity.pk}/'
        self.assertEqual(guest.get(detail).status_code, 404)
        self.assertEqual(guest.get('/api/v1/activities/').data['count'], 0)
        self.assertEqual(self.change(activity, 'published').status_code, 200)
        response = guest.get('/api/v1/activities/?search=Trồng&page_size=1')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['organizer_name'], 'Nhóm Xanh')
        self.assertNotIn('email', response.data['results'][0])
        self.assertEqual(guest.get(detail).status_code, 200)
        self.assertEqual(guest.get('/api/v1/activities/?search=khôngkhớp').data['count'], 0)
        self.assertEqual(guest.post('/api/v1/activities/', {}).status_code, 405)

    def test_owner_boundaries_and_no_delete(self):
        activity = self.create()
        url = f'{self.url}{activity.pk}/'
        self.assertEqual(self.mutate('delete', url, {}).status_code, 405)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.mutate('patch', url, {'title': 'Sai'}).status_code, 404)
        self.assertEqual(self.change(activity, 'published').status_code, 404)
        activity.refresh_from_db()
        self.assertEqual(activity.title, self.payload['title'])

    def test_only_organizer_can_manage_and_csrf_is_required(self):
        self.assertEqual(self.client.post(self.url, self.payload, format='json').status_code, 403)
        for user in [self.volunteer, User.objects.create_superuser('admin.test', 'River-Community-493!')]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.mutate('post', self.url, self.payload).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_validation_and_privileged_fields(self):
        for extra in [{'capacity': 0}, {'capacity': 100001}, {'title': ' '}, {'description': ''}, {'address': ''},
                      {'ends_at': self.start.isoformat()}, {'starts_at': (timezone.now() - timedelta(days=1)).isoformat()},
                      {'organizer': str(self.other.pk)}, {'status': 'published'}, {'published_at': self.start.isoformat()}]:
            with self.subTest(extra=extra):
                self.assertEqual(self.mutate('post', self.url, {**self.payload, **extra}).status_code, 400)
        self.assertFalse(Activity.objects.exists())

    def test_partial_edit_checks_combined_dates_and_does_not_partially_write(self):
        activity = self.create()
        url = f'{self.url}{activity.pk}/'
        response = self.mutate('patch', url, {'title': 'Không lưu', 'ends_at': (self.start - timedelta(hours=1)).isoformat()})
        self.assertEqual(response.status_code, 400)
        activity.refresh_from_db()
        self.assertEqual(activity.title, self.payload['title'])
        self.assertEqual(self.mutate('patch', url, {'address': 'Huế'}).status_code, 200)

    def test_transitions_require_valid_time_and_terminal_states_are_locked(self):
        activity = self.create()
        self.assertEqual(self.change(activity, 'completed').status_code, 400)
        self.assertEqual(self.change(activity, 'published').status_code, 200)
        self.assertEqual(self.change(activity, 'published').status_code, 400)
        self.assertEqual(self.change(activity, 'completed').status_code, 400)
        with patch('apps.activities.views.timezone.now', return_value=self.start + timedelta(hours=3)):
            self.assertEqual(self.change(activity, 'completed').status_code, 200)
        self.assertEqual(self.change(activity, 'cancelled').status_code, 400)
        self.assertEqual(self.mutate('patch', f'{self.url}{activity.pk}/', {'title': 'Sai'}).status_code, 400)
        self.assertEqual(APIClient().get(f'/api/v1/activities/{activity.pk}/').data['status'], 'completed')

    def test_cancelled_draft_stays_private_and_published_cancellation_stays_visible(self):
        draft = self.create()
        self.assertEqual(self.change(draft, 'cancelled').status_code, 200)
        self.assertEqual(APIClient().get(f'/api/v1/activities/{draft.pk}/').status_code, 404)
        self.assertEqual(self.change(draft, 'published').status_code, 400)
        published = self.create()
        self.change(published, 'published')
        self.assertEqual(self.change(published, 'cancelled').status_code, 200)
        self.assertEqual(APIClient().get(f'/api/v1/activities/{published.pk}/').data['status'], 'cancelled')

    def test_expired_draft_cannot_publish_and_database_constraints_hold(self):
        activity = self.create()
        with patch('apps.activities.views.timezone.now', return_value=self.start + timedelta(hours=1)):
            self.assertEqual(self.change(activity, 'published').status_code, 400)
        for changes in [{'capacity': 0}, {'ends_at': self.start - timedelta(hours=1)}, {'status': 'invalid'}]:
            with self.subTest(changes=changes), self.assertRaises(IntegrityError), transaction.atomic():
                Activity.objects.filter(pk=activity.pk).update(**changes)

    def test_pagination_and_query_cannot_expose_foreign_drafts(self):
        for n in range(3):
            activity = self.create()
            self.change(activity, 'published')
        own = self.client.get(self.url + '?page_size=2')
        self.assertEqual(len(own.data['results']), 2)
        self.assertIsNotNone(own.data['next'])
        self.assertEqual(len(self.client.get(self.url + '?page_size=2&page=2').data['results']), 1)
        self.client.force_login(self.other)
        self.create()
        self.assertEqual(self.client.get(self.url + f'?organizer={self.owner.pk}').data['count'], 1)
        public = APIClient().get('/api/v1/activities/?status=draft')
        self.assertEqual(public.data['count'], 3)
