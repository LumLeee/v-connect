from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core.cache import cache
from django.db import IntegrityError, connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from .models import Attendance
from .tests import fixtures
from . import services


def approved_fixture():
    owner, one, two, activity = fixtures()
    entry = services.register(activity.pk, one)
    services.review(activity.pk, entry.pk, owner, 'approved')
    now = timezone.now()
    Activity.objects.filter(pk=activity.pk).update(starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=1))
    activity.refresh_from_db()
    return owner, one, two, activity, entry


class AttendanceTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity, self.entry = approved_fixture()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.base = f'/api/v1/organizer/activities/{self.activity.pk}/'
        self.url = f'{self.base}attendance/{self.entry.pk}/'

    def post(self, url=None, data=None):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url or self.url, {} if data is None else data, format='json', HTTP_X_CSRFTOKEN=token)

    def test_confirm_and_retry_preserve_original_audit(self):
        first = self.post()
        self.assertEqual(first.status_code, 201)
        again = self.post()
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.data, again.data)
        record = Attendance.objects.get()
        self.assertEqual(record.confirmed_by, self.owner)
        self.assertEqual(record.participation, self.entry)
        self.assertEqual(self.client.get(self.base + 'attendance/').data['results'][0]['attendance']['id'], str(record.id))

    def test_time_boundaries_are_enforced_by_server(self):
        for when, expected in [(self.activity.starts_at - timedelta(microseconds=1), 400),
                               (self.activity.starts_at, 201), (self.activity.ends_at, 200),
                               (self.activity.ends_at + timedelta(microseconds=1), 400)]:
            with self.subTest(when=when), patch('apps.participations.services.timezone.now', return_value=when):
                self.assertEqual(self.post().status_code, expected)
        self.assertEqual(Attendance.objects.count(), 1)

    def test_nonapproved_entries_and_terminal_activities_are_rejected(self):
        for status in ['pending', 'rejected', 'cancelled']:
            self.entry.status = status
            self.entry.save(update_fields=['status'])
            self.assertEqual(self.post().status_code, 400)
            self.assertEqual(self.client.get(self.base + 'attendance/').data['count'], 0)
        self.entry.status = 'approved'
        self.entry.save(update_fields=['status'])
        for status in ['draft', 'completed', 'cancelled']:
            Activity.objects.filter(pk=self.activity.pk).update(status=status)
            self.assertEqual(self.post().status_code, 400)
        self.assertFalse(Attendance.objects.exists())

    def test_csrf_roles_and_ownership(self):
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 403)
        for role in ['volunteer', 'admin']:
            user = User.objects.create_user(f'{role}@example.invalid', role=role, full_name=role, **({'username': 'attendance.admin'} if role == 'admin' else {}))
            self.client.force_login(user)
            self.assertEqual(self.post().status_code, 403)
            self.assertEqual(self.client.get(self.base + 'attendance/').status_code, 403)
        other = User.objects.create_user('otherorg@example.invalid', role='organizer', full_name='Khác')
        self.client.force_login(other)
        self.assertEqual(self.post().status_code, 404)
        self.assertEqual(self.client.get(self.base + 'attendance/').status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get(self.base + 'attendance/').status_code, 401)
        self.assertFalse(Attendance.objects.exists())

    def test_foreign_participation_and_forged_audit_fields(self):
        other = Activity.objects.create(organizer=self.owner, title='Khác', description='Khác', address='Huế',
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at, capacity=1, status='published', published_at=timezone.now())
        self.assertEqual(self.post(f'/api/v1/organizer/activities/{other.pk}/attendance/{self.entry.pk}/').status_code, 404)
        for payload in [{'confirmed_by': str(self.one.pk)}, {'confirmed_at': timezone.now().isoformat()}, {'present': False}]:
            self.assertEqual(self.post(data=payload).status_code, 400)
        self.assertFalse(Attendance.objects.exists())

    def test_volunteer_history_is_private_and_survives_completion(self):
        self.post()
        Activity.objects.filter(pk=self.activity.pk).update(status='completed')
        self.client.force_login(self.one)
        history = self.client.get('/api/v1/participations/history/').data
        self.assertEqual(history['count'], 1)
        self.assertIsNotNone(history['results'][0]['attendance'])
        self.assertEqual(history['results'][0]['activity']['status'], 'completed')
        self.assertIn('no-store', self.client.get('/api/v1/participations/history/')['Cache-Control'])
        self.client.force_login(self.two)
        self.assertEqual(self.client.get('/api/v1/participations/history/').data['count'], 0)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get('/api/v1/participations/history/').status_code, 403)

    def test_cancellation_preserves_record_but_stops_further_attendance(self):
        first = self.post().data
        self.assertEqual(self.post(self.base + 'status/', {'status': 'cancelled'}).status_code, 200)
        self.assertEqual(self.post().status_code, 400)
        row = self.client.get(self.base + 'attendance/').data['results'][0]
        self.assertEqual(row['status'], 'cancelled')
        self.assertEqual(row['attendance'], first)
        self.client.force_login(self.one)
        self.assertEqual(self.client.get('/api/v1/participations/history/').data['count'], 1)

    def test_unique_constraint_and_no_update_delete_api(self):
        self.post()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Attendance.objects.create(participation=self.entry, confirmed_by=self.owner)
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        for method in [self.client.patch, self.client.delete]:
            self.assertEqual(method(self.url, {}, format='json', HTTP_X_CSRFTOKEN=token).status_code, 405)
        self.assertEqual(Attendance.objects.count(), 1)


class AttendanceConcurrencyTests(TransactionTestCase):
    def test_concurrent_confirmation_creates_one_record(self):
        owner, _, _, activity, entry = approved_fixture()
        barrier = Barrier(2)
        def confirm(_):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                record, created = services.confirm_attendance(activity.pk, entry.pk, owner)
                return str(record.pk), created
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(confirm, range(2)))
        self.assertEqual(results[0][0], results[1][0])
        self.assertCountEqual([created for _, created in results], [True, False])
        self.assertEqual(Attendance.objects.count(), 1)
