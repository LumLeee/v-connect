from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.contrib import admin
from django.core.cache import cache
from django.db import connections
from django.test import RequestFactory, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Attendance, Participation
from apps.participations import services as participation_services
from apps.feedback import services as feedback_services
from apps.feedback.tests import fixtures
from .models import AuditEvent
from . import services


class ReportTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, self.attendances = fixtures()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.admin)

    def post(self, url, data):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url, data, format='json', HTTP_X_CSRFTOKEN=token)

    def extra_activity(self, status, volunteer, attended=True):
        now = timezone.now()
        activity = Activity.objects.create(organizer=self.owner, title=status, description='Mô tả', address='Huế', capacity=2,
            starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=1), status=status, published_at=now - timedelta(days=1))
        entry = Participation.objects.create(activity=activity, volunteer=volunteer, status='cancelled' if status == 'cancelled' else 'approved',
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)
        if attended:
            Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        return activity

    def test_counts_split_completed_ongoing_cancelled_and_match_details(self):
        self.extra_activity('published', self.one)
        self.extra_activity('cancelled', self.one)
        self.client.force_login(self.one)
        metrics = self.client.get('/api/v1/reports/overview/').data['metrics']
        self.assertEqual(metrics['registered'], 3)
        self.assertEqual(metrics['approved'], 2)
        for name in ['attended_completed', 'attended_ongoing', 'attended_cancelled']:
            self.assertEqual(metrics[name], 1)
        for name in services.METRICS:
            response = self.client.get(f'/api/v1/reports/participations/?metric={name}&page_size=1')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['count'], metrics[name])
            if response.data['results']:
                self.assertNotIn('volunteer_email', response.data['results'][0])
        self.client.force_login(self.two)
        self.assertEqual(self.client.get('/api/v1/reports/overview/').data['metrics']['registered'], 1)

    def test_activity_result_and_feedback_statistics_exclude_hidden(self):
        one = feedback_services.submit(self.activity.pk, self.one, {'rating': 5, 'content': 'A'})
        feedback_services.submit(self.activity.pk, self.two, {'rating': 1, 'content': 'B'})
        self.client.force_login(self.owner)
        url = f'/api/v1/reports/activities/{self.activity.pk}/'
        metrics = self.client.get(url).data['metrics']
        self.assertEqual(metrics['registered'], 2)
        self.assertEqual(metrics['attended_completed'], 2)
        self.assertEqual(metrics['feedback'], {'count': 2, 'average_rating': 3.0})
        feedback_services.hide(one.pk, self.admin, 'Không phù hợp')
        self.assertEqual(self.client.get(url).data['metrics']['feedback'], {'count': 1, 'average_rating': 1.0})
        self.assertEqual(self.client.get('/api/v1/reports/overview/').data['activities'], {'completed': 1})

    def test_role_and_ownership_scoping(self):
        other = User.objects.create_user('other.org@example.invalid', role='organizer', full_name='Khác')
        self.client.force_login(other)
        self.assertEqual(self.client.get('/api/v1/reports/overview/').data['metrics']['registered'], 0)
        self.assertEqual(self.client.get(f'/api/v1/reports/activities/{self.activity.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/reports/participations/?activity={self.activity.pk}').status_code, 404)
        for path in ['accounts', 'audit']:
            self.assertEqual(self.client.get(f'/api/v1/admin/{path}/').status_code, 403)
        self.client.force_login(self.one)
        self.assertEqual(self.client.get('/api/v1/reports/activities/').status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get('/api/v1/reports/overview/').status_code, 401)

    def test_admin_filters_pagination_and_invalid_queries(self):
        response = self.client.get('/api/v1/admin/accounts/?role=volunteer&page_size=1')
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertNotIn('password', response.data['results'][0])
        self.assertNotIn('session_version', response.data['results'][0])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(self.client.get('/api/v1/admin/accounts/?search=feedback.one').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/reports/activities/?status=completed&search=Trồng').data['count'], 1)
        for url in ['/api/v1/admin/accounts/?role=bad', '/api/v1/admin/accounts/?status=bad',
                    '/api/v1/admin/audit/?action=bad', '/api/v1/reports/participations/?metric=bad',
                    '/api/v1/reports/participations/?activity=not-a-uuid', '/api/v1/reports/activities/?status=bad']:
            self.assertEqual(self.client.get(url).status_code, 400)

    def test_lock_unlock_invalidates_even_unused_old_session_and_preserves_password(self):
        self.one.set_password('River-Community-493!')
        self.one.save(update_fields=['password'])
        password = self.one.password
        old = APIClient()
        old.force_login(self.one)
        url = f'/api/v1/admin/accounts/{self.one.pk}/status/'
        self.assertEqual(self.post(url, {'is_active': False, 'reason': 'Vi phạm'}).status_code, 200)
        self.one.refresh_from_db()
        self.assertFalse(self.one.is_active)
        self.assertEqual(self.client.get('/api/v1/admin/accounts/?status=locked').data['count'], 1)
        self.assertEqual(self.post(url, {'is_active': True, 'reason': 'Đã xử lý'}).status_code, 200)
        self.assertEqual(old.get('/api/v1/auth/me/').status_code, 401)
        self.one.refresh_from_db()
        self.assertEqual(self.one.password, password)
        self.assertTrue(old.login(identifier=self.one.email, password='River-Community-493!'))
        self.assertEqual(old.get('/api/v1/auth/me/').status_code, 200)
        self.assertEqual(AuditEvent.objects.filter(subject=self.one).count(), 2)

    def test_lock_requires_reason_csrf_admin_and_preserves_first_audit_on_retry(self):
        url = f'/api/v1/admin/accounts/{self.one.pk}/status/'
        self.assertEqual(self.client.post(url, {'is_active': False, 'reason': 'A'}, format='json').status_code, 403)
        for data in [{'is_active': False}, {'is_active': False, 'reason': '  '}, {'is_active': False, 'reason': 'A', 'role': 'admin'}]:
            self.assertEqual(self.post(url, data).status_code, 400)
        self.assertEqual(self.post(f'/api/v1/admin/accounts/{self.admin.pk}/status/', {'is_active': False, 'reason': 'A'}).status_code, 400)
        self.post(url, {'is_active': False, 'reason': 'Lần đầu'})
        self.post(url, {'is_active': False, 'reason': 'Lần hai'})
        self.assertEqual(AuditEvent.objects.get().reason, 'Lần đầu')
        self.client.force_login(self.owner)
        self.assertEqual(self.post(url, {'is_active': True, 'reason': 'A'}).status_code, 403)

    def test_audit_for_review_survives_reregistration_and_attendance_retry(self):
        now = timezone.now()
        activity = self.extra_activity('published', self.two, attended=False)
        Activity.objects.filter(pk=activity.pk).update(starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2))
        entry = Participation.objects.get(activity=activity)
        entry.status = 'pending'
        entry.save(update_fields=['status'])
        participation_services.review(activity.pk, entry.pk, self.owner, 'approved')
        participation_services.cancel(activity.pk, self.two)
        participation_services.register(activity.pk, self.two)
        participation_services.review(activity.pk, entry.pk, self.owner, 'approved')
        self.assertEqual(AuditEvent.objects.filter(action='review_approved', object_id=entry.pk).count(), 2)
        Activity.objects.filter(pk=activity.pk).update(starts_at=now - timedelta(minutes=1))
        participation_services.confirm_attendance(activity.pk, entry.pk, self.owner)
        participation_services.confirm_attendance(activity.pk, entry.pk, self.owner)
        self.assertEqual(AuditEvent.objects.filter(action='attendance_confirmed').count(), 1)
        response = self.client.get('/api/v1/admin/audit/?action=review_approved')
        self.assertEqual(response.data['count'], 2)

    def test_django_admin_business_records_are_readonly(self):
        request = RequestFactory().get('/admin/')
        request.user = self.admin
        for model in [Activity, Participation, Attendance, AuditEvent]:
            model_admin = admin.site._registry[model]
            self.assertTrue(model_admin.has_view_permission(request))
            self.assertFalse(model_admin.has_add_permission(request))
            self.assertFalse(model_admin.has_change_permission(request))
            self.assertFalse(model_admin.has_delete_permission(request))
        self.assertIn('is_active', admin.site._registry[User].get_readonly_fields(request))


class AccountConcurrencyTests(TransactionTestCase):
    def test_duplicate_lock_creates_one_event(self):
        _, one, _, admin_user, _, _ = fixtures()
        barrier = Barrier(2)
        def lock(_):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                services.set_account_status(admin_user, one.pk, False, 'Lý do')
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lock, range(2)))
        self.assertEqual(AuditEvent.objects.filter(action='account_locked').count(), 1)
        one.refresh_from_db()
        self.assertEqual(one.session_version, 1)
