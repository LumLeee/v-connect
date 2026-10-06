from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core.cache import cache
from django.db import connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.notifications.models import Notification
from apps.reports.models import AuditEvent
from . import checkin, services
from .models import Attendance, AttendanceCode
from .tests import fixtures


def setup_activity():
    owner, one, two, activity = fixtures()
    activity.capacity = 10
    activity.save()
    entries = []
    for user in [one, two]:
        entry = services.register(activity.pk, user)
        entries.append(services.review(activity.pk, entry.pk, owner, 'approved'))
    activity.starts_at = timezone.now() - timedelta(minutes=5)
    activity.ends_at = timezone.now() + timedelta(hours=1)
    activity.save()
    Notification.objects.all().delete()
    return owner, one, two, activity, entries


class CheckInTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity, self.entries = setup_activity()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.managed = f'/api/v1/organizer/activities/{self.activity.pk}/attendance-code/'
        self.url = f'/api/v1/activities/{self.activity.pk}/check-in/'

    def post(self, url, data=None):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    def test_issue_read_rotate_revoke_and_no_plain_credentials_in_storage(self):
        self.assertFalse(self.client.get(self.managed).data['active'])
        first = self.post(self.managed)
        self.assertEqual(first.status_code, 201)
        self.assertRegex(first.data['code'], r'^\d{8}$')
        self.assertEqual(self.client.get(self.managed).data['qr_value'], first.data['qr_value'])
        record = AttendanceCode.objects.get()
        self.assertNotIn(first.data['code'], str(record.__dict__))
        second = self.post(self.managed).data
        self.assertNotEqual(first.data['code'], second['code'])
        self.assertNotEqual(first.data['qr_value'], second['qr_value'])
        self.assertEqual(AttendanceCode.objects.count(), 1)
        with self.assertRaises(ValidationError):
            checkin.check_in(self.activity.pk, self.one, {'code': first.data['code']})
        self.assertFalse(self.post(self.managed + 'revoke/').data['active'])
        self.post(self.managed + 'revoke/')
        self.assertEqual(AuditEvent.objects.filter(action='attendance_code_revoked').count(), 1)
        with self.assertRaises(ValidationError):
            checkin.check_in(self.activity.pk, self.one, {'token': second['qr_value'].split(':')[-1]})

    def test_owner_only_csrf_and_rejected_payloads(self):
        self.assertEqual(self.client.post(self.managed, {}).status_code, 403)
        self.assertEqual(self.post(self.managed, {'expires_at': '2099-01-01'}).status_code, 400)
        other = User.objects.create_user('other.checkin@example.invalid', full_name='Khác', role='organizer')
        self.client.force_login(other)
        for url in [self.managed, self.managed + 'revoke/']:
            self.assertEqual(self.post(url).status_code, 404)
        self.assertEqual(self.client.get(self.managed).status_code, 404)
        self.client.force_login(self.one)
        self.assertEqual(self.client.get(self.managed).status_code, 403)
        self.assertEqual(self.post(self.managed).status_code, 403)
        self.assertEqual(self.client.post(self.url, {'code': '12345678'}).status_code, 403)
        self.assertEqual(self.post(self.url, {'code': '12345678', 'token': 'a' * 64}).status_code, 400)
        self.assertEqual(self.post(self.url, {'code': '12345678', 'volunteer': str(self.two.pk)}).status_code, 400)
        self.assertEqual(self.post(self.url, {'code': '123'}).status_code, 400)

    def test_qr_and_code_record_actor_method_and_one_notification(self):
        issued = checkin.issue(self.activity.pk, self.owner)
        self.client.force_login(self.one)
        token = issued['qr_value'].split(':')[-1]
        first = self.post(self.url, {'token': token})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['method'], 'qr')
        self.assertEqual(first.data['confirmed_by_name'], self.one.full_name)
        duplicate = self.post(self.url, {'code': issued['code']})
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.data, first.data)
        original, created = services.confirm_attendance(self.activity.pk, self.entries[0].pk, self.owner)
        self.assertFalse(created)
        self.assertEqual(original.method, 'qr')
        checkin.check_in(self.activity.pk, self.two, {'code': issued['code']})
        self.assertEqual(Attendance.objects.filter(method='code').count(), 1)
        self.assertEqual(Notification.objects.filter(kind='attendance').count(), 2)
        self.assertEqual(AuditEvent.objects.filter(action='attendance_confirmed', actor=self.one).count(), 1)

    def test_manual_evidence_preserved_when_checkin_retried(self):
        manual, _ = services.confirm_attendance(self.activity.pk, self.entries[0].pk, self.owner)
        issued = checkin.issue(self.activity.pk, self.owner)
        result, created = checkin.check_in(self.activity.pk, self.one, {'code': issued['code']})
        self.assertFalse(created)
        self.assertEqual(result.pk, manual.pk)
        self.assertEqual(result.method, 'manual')
        self.assertEqual(result.confirmed_by, self.owner)

    def test_expiry_and_window_boundaries(self):
        with patch('django.utils.timezone.now', return_value=self.activity.starts_at - timedelta(seconds=1)):
            with self.assertRaises(ValidationError):
                checkin.issue(self.activity.pk, self.owner)
        start = self.activity.starts_at
        with patch('django.utils.timezone.now', return_value=start):
            issued = checkin.issue(self.activity.pk, self.owner)
        self.assertEqual(issued['expires_at'], start + timedelta(minutes=5))
        with patch('django.utils.timezone.now', return_value=issued['expires_at'] - timedelta(microseconds=1)):
            checkin.check_in(self.activity.pk, self.one, {'code': issued['code']})
        with patch('django.utils.timezone.now', return_value=issued['expires_at']):
            with self.assertRaises(ValidationError):
                checkin.check_in(self.activity.pk, self.two, {'code': issued['code']})
            self.assertNotIn('code', checkin.session_data(self.activity))
        with patch('django.utils.timezone.now', return_value=self.activity.ends_at - timedelta(seconds=30)):
            self.assertEqual(checkin.issue(self.activity.pk, self.owner)['expires_at'], self.activity.ends_at)
        with patch('django.utils.timezone.now', return_value=self.activity.ends_at):
            with self.assertRaises(ValidationError):
                checkin.issue(self.activity.pk, self.owner)
        with patch('django.utils.timezone.now', return_value=self.activity.ends_at + timedelta(seconds=1)):
            with self.assertRaises(ValidationError):
                checkin.check_in(self.activity.pk, self.two, {'code': issued['code']})

    def test_pending_cancelled_rejected_and_unregistered_cannot_checkin(self):
        issued = checkin.issue(self.activity.pk, self.owner)
        entry = self.entries[0]
        for status in ['pending', 'cancelled', 'rejected']:
            entry.status = status
            entry.save()
            with self.assertRaises(ValidationError):
                checkin.check_in(self.activity.pk, self.one, {'code': issued['code']})
        outsider = User.objects.create_user('outsider.checkin@example.invalid', full_name='Chưa đăng ký')
        self.client.force_login(outsider)
        self.assertEqual(self.post(self.url, {'code': issued['code']}).status_code, 404)
        self.assertFalse(Attendance.objects.exists())

    def test_wrong_code_throttled_and_no_record_or_notification(self):
        issued = checkin.issue(self.activity.pk, self.owner)
        wrong = '00000000' if issued['code'] != '00000000' else '11111111'
        self.client.force_login(self.one)
        for _ in range(6):
            self.assertEqual(self.post(self.url, {'code': wrong}).status_code, 400)
        self.assertEqual(self.post(self.url, {'code': issued['code']}).status_code, 429)
        self.assertFalse(Attendance.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_activity_cancel_or_address_edit_invalidates_code(self):
        issued = checkin.issue(self.activity.pk, self.owner)
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        url = f'/api/v1/organizer/activities/{self.activity.pk}/'
        self.assertEqual(self.client.patch(url, {'address': 'Đà Nẵng'}, format='json', HTTP_X_CSRFTOKEN=token).status_code, 200)
        with self.assertRaises(ValidationError):
            checkin.check_in(self.activity.pk, self.one, {'code': issued['code']})
        issued = checkin.issue(self.activity.pk, self.owner)
        self.assertEqual(self.post(url + 'status/', {'status': 'cancelled'}).status_code, 200)
        self.activity.refresh_from_db()
        self.assertFalse(checkin.session_data(self.activity)['active'])
        with self.assertRaises(ValidationError):
            checkin.check_in(self.activity.pk, self.one, {'code': issued['code']})

    def test_code_cannot_be_used_for_another_activity_and_rollback_is_atomic(self):
        issued = checkin.issue(self.activity.pk, self.owner)
        other = Activity.objects.create(organizer=self.owner, title='Khác', description='Khác', address='Huế',
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at, capacity=10, status='published', published_at=timezone.now())
        other_session = checkin.issue(other.pk, self.owner)
        self.assertNotEqual(other_session['qr_value'], issued['qr_value'])
        with self.assertRaises(ValidationError):
            checkin.check_in(self.activity.pk, self.one, {'token': other_session['qr_value'].split(':')[-1]})
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                checkin.check_in(self.activity.pk, self.one, {'code': issued['code']})
                raise RuntimeError('rollback')
        self.assertFalse(Attendance.objects.exists())
        self.assertFalse(Notification.objects.exists())


class CheckInConcurrencyTests(TransactionTestCase):
    def test_manual_and_qr_race_keep_one_attendance_and_notification(self):
        owner, one, two, activity, entries = setup_activity()
        issued = checkin.issue(activity.pk, owner)
        barrier = Barrier(2)
        def run(manual):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return (services.confirm_attendance(activity.pk, entries[0].pk, owner) if manual else
                        checkin.check_in(activity.pk, one, {'code': issued['code']}))[1]
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(run, [True, False])), 1)
        self.assertEqual(Attendance.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(kind='attendance').count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='attendance_confirmed').count(), 1)
