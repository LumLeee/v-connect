from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core.cache import cache
from django.db import IntegrityError, connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from .models import Participation
from . import services


def fixtures():
    owner = User.objects.create_user('org@example.invalid', full_name='Tổ chức', role='organizer')
    volunteer = User.objects.create_user('one@example.invalid', full_name='Một')
    second = User.objects.create_user('two@example.invalid', full_name='Hai')
    now = timezone.now()
    activity = Activity.objects.create(organizer=owner, title='Cộng đồng', description='Mô tả', address='Huế',
        starts_at=now + timedelta(days=2), ends_at=now + timedelta(days=2, hours=2), capacity=1, status='published', published_at=now)
    return owner, volunteer, second, activity


class ParticipationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity = fixtures()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.one)
        self.url = f'/api/v1/activities/{self.activity.pk}/participation/'
        self.managed = f'/api/v1/organizer/activities/{self.activity.pk}/'

    def post(self, url, data=None):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    def test_register_duplicate_cancel_and_reregister(self):
        first = self.post(self.url)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['participation']['status'], 'pending')
        self.assertEqual(self.post(self.url).status_code, 400)
        self.assertEqual(self.post(self.url + 'cancel/').status_code, 200)
        self.assertEqual(self.post(self.url).status_code, 201)
        self.assertEqual(Participation.objects.count(), 1)
        self.assertEqual(self.client.get('/api/v1/participations/').data['count'], 1)

    def test_rejection_is_final_and_foreign_ids_not_accepted(self):
        entry = services.register(self.activity.pk, self.one)
        self.client.force_login(self.owner)
        url = f'{self.managed}applicants/{entry.pk}/review/'
        self.assertEqual(self.post(url, {'status': 'rejected'}).status_code, 200)
        self.assertEqual(self.post(url, {'status': 'approved'}).status_code, 400)
        self.client.force_login(self.one)
        self.assertEqual(self.post(self.url).status_code, 400)
        self.assertEqual(self.post(self.url + 'cancel/').status_code, 400)
        self.assertEqual(self.post(self.url, {'volunteer': str(self.two.pk)}).status_code, 400)

    def test_capacity_and_cancellation_release_place(self):
        one = services.register(self.activity.pk, self.one)
        two = services.register(self.activity.pk, self.two)
        services.review(self.activity.pk, one.pk, self.owner, 'approved')
        with self.assertRaises(ValidationError):
            services.review(self.activity.pk, two.pk, self.owner, 'approved')
        services.cancel(self.activity.pk, self.one)
        services.review(self.activity.pk, two.pk, self.owner, 'approved')
        self.assertEqual(Participation.objects.filter(status='approved').count(), 1)
        with self.assertRaises(ValidationError):
            services.register(self.activity.pk, self.one)

    def test_deadline_blocks_all_three_mutations(self):
        entry = services.register(self.activity.pk, self.one)
        with patch('apps.participations.services.timezone.now', return_value=self.activity.starts_at):
            for action in [lambda: services.register(self.activity.pk, self.two), lambda: services.cancel(self.activity.pk, self.one),
                           lambda: services.review(self.activity.pk, entry.pk, self.owner, 'approved')]:
                with self.assertRaises(ValidationError):
                    action()
        entry.refresh_from_db()
        self.assertEqual(entry.status, 'pending')

    def test_permissions_csrf_and_private_applicant_data(self):
        entry = services.register(self.activity.pk, self.one)
        self.assertEqual(self.client.post(self.url + 'cancel/', {}, format='json').status_code, 403)
        self.client.force_login(self.two)
        self.assertEqual(self.client.get('/api/v1/participations/').data['count'], 0)
        self.assertIsNone(self.client.get(self.url).data['participation'])
        self.assertEqual(self.post(self.url + 'cancel/').status_code, 404)
        self.assertEqual(self.client.get(self.managed + 'applicants/').status_code, 403)
        other = User.objects.create_user('other@example.invalid', full_name='Khác', role='organizer')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.managed + 'applicants/').status_code, 404)
        self.assertEqual(self.post(f'{self.managed}applicants/{entry.pk}/review/', {'status': 'approved'}).status_code, 404)
        self.assertEqual(self.post(self.url).status_code, 403)
        self.client.force_login(self.owner)
        row = self.client.get(self.managed + 'applicants/').data['results'][0]
        self.assertEqual(row['volunteer_email'], self.one.email)
        self.assertNotIn('password', row)
        self.client.logout()
        self.assertEqual(self.client.get('/api/v1/participations/').status_code, 401)

    def test_activity_cancel_updates_active_applications_and_keeps_history(self):
        one = services.register(self.activity.pk, self.one)
        services.review(self.activity.pk, one.pk, self.owner, 'approved')
        Activity.objects.filter(pk=self.activity.pk).update(capacity=2)
        services.register(self.activity.pk, self.two)
        self.client.force_login(self.owner)
        self.assertEqual(self.post(self.managed + 'status/', {'status': 'cancelled'}).status_code, 200)
        self.assertEqual(Participation.objects.filter(status='cancelled', cancellation_reason='activity_cancelled').count(), 2)
        one.refresh_from_db()
        self.assertEqual(one.reviewed_by_id, self.owner.pk)
        with self.assertRaises(ValidationError):
            services.register(self.activity.pk, self.one)

    def test_capacity_cannot_be_lowered_below_approved_and_changes_are_visible(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=2)
        for user in [self.one, self.two]:
            entry = services.register(self.activity.pk, user)
            services.review(self.activity.pk, entry.pk, self.owner, 'approved')
        self.client.force_login(self.owner)
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        result = self.client.patch(self.managed, {'capacity': 1}, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.client.patch(self.managed, {'address': 'Đà Nẵng'}, format='json', HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.client.force_login(self.one)
        data = self.client.get(self.url).data['participation']
        self.assertTrue(data['activity_changed'])
        self.assertEqual(data['activity']['address'], 'Đà Nẵng')

    def test_draft_hidden_in_registration_and_duplicate_constraint(self):
        Activity.objects.filter(pk=self.activity.pk).update(status='draft', published_at=None)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.post(self.url).status_code, 404)
        Activity.objects.filter(pk=self.activity.pk).update(status='published', published_at=timezone.now())
        entry = services.register(self.activity.pk, self.one)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Participation.objects.create(activity=self.activity, volunteer=self.one, registered_starts_at=entry.registered_starts_at,
                registered_ends_at=entry.registered_ends_at, registered_address=entry.registered_address)

    def test_inactive_applicant_cannot_be_approved(self):
        entry = services.register(self.activity.pk, self.one)
        User.objects.filter(pk=self.one.pk).update(is_active=False)
        with self.assertRaises(ValidationError):
            services.review(self.activity.pk, entry.pk, self.owner, 'approved')


class ParticipationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner, self.one, self.two, self.activity = fixtures()

    def parallel(self, actions):
        barrier = Barrier(len(actions))
        def execute(action):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                action()
                return 'ok'
            except ValidationError:
                return 'rejected'
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(actions)) as pool:
            return list(pool.map(execute, actions))

    def test_two_simultaneous_approvals_cannot_take_last_place_twice(self):
        entries = [services.register(self.activity.pk, user) for user in [self.one, self.two]]
        result = self.parallel([lambda entry=entry: services.review(self.activity.pk, entry.pk, self.owner, 'approved') for entry in entries])
        self.assertCountEqual(result, ['ok', 'rejected'])
        self.assertEqual(Participation.objects.filter(status='approved').count(), 1)

    def test_simultaneous_registration_creates_one_application(self):
        result = self.parallel([lambda: services.register(self.activity.pk, self.one)] * 2)
        self.assertCountEqual(result, ['ok', 'rejected'])
        self.assertEqual(Participation.objects.count(), 1)
