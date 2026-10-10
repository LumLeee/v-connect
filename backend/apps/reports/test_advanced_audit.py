from datetime import datetime, timedelta, timezone as utc_timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Attendance, Participation
from apps.participations.contributions import confirm
from apps.participations.checkin import issue
from .models import AuditEvent
from .services import set_account_status


class AdvancedAuditTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('audit.org@example.invalid', role='organizer', full_name='Nhà tổ chức')
        self.vol = User.objects.create_user('audit.vol@example.invalid', full_name='Người tham gia')
        self.admin = User.objects.create_user(role='admin', username='audit.admin', full_name='Quản trị')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.start = timezone.now() + timedelta(days=3)
        self.activity = Activity.objects.create(organizer=self.owner, title='Hoạt động nhật ký', description='Cũ',
            address='Huế', capacity=20, starts_at=self.start, ends_at=self.start + timedelta(hours=4))
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/'

    def mutate(self, url, data, method='patch'):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return getattr(self.client, method)(url, data, format='json', HTTP_X_CSRFTOKEN=token)

    def test_activity_changes_only_actual_fields_and_stable_timeline(self):
        milestone = dict(title='Đón tiếp', starts_at=self.start.isoformat(), ends_at=(self.start + timedelta(hours=1)).isoformat())
        response = self.mutate(self.url, {'description': 'Mới', 'timeline': [milestone]})
        self.assertEqual(response.status_code, 200, response.data)
        event = AuditEvent.objects.get(action='activity_updated')
        self.assertEqual(event.before, {'description': 'Cũ', 'timeline': []})
        self.assertEqual(event.after['description'], 'Mới')
        self.assertEqual(event.after['timeline'][0]['title'], 'Đón tiếp')
        self.mutate(self.url, {'description': 'Mới', 'timeline': [milestone], 'starts_at': self.start.astimezone(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat()})
        self.assertEqual(AuditEvent.objects.count(), 1)
        self.mutate(self.url, {'description': 'Lần sau', 'timeline': []})
        event.refresh_from_db()
        self.assertEqual(event.after['description'], 'Mới')
        self.assertEqual(len(event.after['timeline']), 1)

    def test_failed_audit_rolls_back_activity_and_timeline(self):
        self.activity.timeline.create(title='Cũ', starts_at=self.start, ends_at=self.start + timedelta(hours=1))
        with patch('apps.reports.audit.AuditEvent.objects.create', side_effect=IntegrityError('audit failure')):
            response = self.mutate(self.url, {'description': 'Không lưu', 'timeline': []})
        self.assertEqual(response.status_code, 500)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.description, 'Cũ')
        self.assertEqual(self.activity.timeline.get().title, 'Cũ')
        self.assertFalse(AuditEvent.objects.exists())

    def test_validation_failure_no_event_and_status_snapshot(self):
        self.assertEqual(self.mutate(self.url, {'capacity': 0}).status_code, 400)
        self.assertFalse(AuditEvent.objects.exists())
        self.assertEqual(self.mutate(self.url + 'status/', {'status': 'published'}, 'post').status_code, 200)
        event = AuditEvent.objects.get()
        self.assertEqual(event.before, {'status': 'draft'})
        self.assertEqual(event.after, {'status': 'published'})

    def test_vietnam_date_boundaries_combined_filters_and_pagination(self):
        boundary = datetime(2026, 10, 9, 17, tzinfo=utc_timezone.utc)
        for instant in [boundary - timedelta(microseconds=1), boundary, boundary + timedelta(days=1) - timedelta(microseconds=1), boundary + timedelta(days=1)]:
            AuditEvent.objects.create(actor=self.owner, subject=self.vol, activity=self.activity, object_id=self.activity.pk,
                action='activity_updated', created_at=instant)
        self.client.force_login(self.admin)
        query = f'/api/v1/admin/audit/?date_from=2026-10-10&date_to=2026-10-10&actor={self.owner.pk}&subject={self.vol.pk}&activity={self.activity.pk}&action=activity_updated&page_size=1'
        response = self.client.get(query)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])
        self.assertNotIn('before', response.data['results'][0])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(self.client.get('/api/v1/admin/audit/?actor_search=audit.org&subject_search=Người&activity_search=nhật').data['count'], 4)
        self.assertEqual(self.client.get(f'/api/v1/admin/audit/?actor={self.vol.pk}').data['count'], 0)
        for query in ['date_from=bad', 'date_from=0001-01-01', 'date_to=9999-12-31', 'date_from=2026-10-11&date_to=2026-10-10', 'actor=bad', 'subject=bad', 'activity=bad', 'object_id=bad', 'action=bad', 'actor_search=' + 'x' * 201]:
            self.assertEqual(self.client.get('/api/v1/admin/audit/?' + query).status_code, 400)

    def test_detail_permissions_read_only_and_legacy(self):
        event = AuditEvent.objects.create(actor=self.owner, activity=self.activity, object_id=self.activity.pk, action='activity_updated')
        url = f'/api/v1/admin/audit/{event.pk}/'
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_login(self.vol)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_login(self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['before'])
        self.assertIsNone(response.data['after'])
        self.assertIn('no-store', response['Cache-Control'])
        for method in ['post', 'patch', 'delete']:
            self.assertEqual(self.mutate(url, {}, method).status_code, 405)

    def test_account_contribution_and_qr_snapshots_exclude_secrets(self):
        set_account_status(self.admin, self.vol.pk, False, 'Kiểm tra')
        set_account_status(self.admin, self.vol.pk, False, 'Lặp')
        event = AuditEvent.objects.get(action='account_locked')
        self.assertEqual(event.before, {'is_active': True})
        self.assertEqual(event.after, {'is_active': False})
        self.activity.status = 'published'
        self.activity.starts_at = timezone.now() - timedelta(hours=1)
        self.activity.ends_at = timezone.now() + timedelta(hours=1)
        self.activity.save()
        issue(self.activity.pk, self.owner)
        event = AuditEvent.objects.get(action='attendance_code_issued')
        self.assertEqual(set(event.after), {'issued_at', 'expires_at', 'revoked_at'})
        entry = Participation.objects.create(activity=self.activity, volunteer=self.vol, status='approved',
            registered_starts_at=self.activity.starts_at, registered_ends_at=self.activity.ends_at, registered_address='Huế')
        attendance = Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        self.activity.status = 'completed'
        self.activity.ends_at = timezone.now() - timedelta(minutes=1)
        self.activity.save()
        confirm(self.owner, self.activity.pk, attendance.pk, {'minutes': 30, 'revision': 0, 'reason': ''})
        confirm(self.owner, self.activity.pk, attendance.pk, {'minutes': 20, 'revision': 1, 'reason': 'Đối chiếu'})
        confirm(self.owner, self.activity.pk, attendance.pk, {'minutes': 20, 'revision': 2, 'reason': 'Lặp'})
        event = AuditEvent.objects.get(action='contribution_updated')
        self.assertEqual(event.before, {'minutes': 30, 'revision': 1})
        self.assertEqual(event.after, {'minutes': 20, 'revision': 2})
        self.assertEqual(event.reason, 'Đối chiếu')
