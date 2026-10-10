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
from apps.feedback.tests import fixtures
from apps.feedback.services import submit, hide
from apps.participations.contributions import confirm
from apps.participations.models import Contribution
from .certificate_services import issue_certificate, revoke_certificate
from .models import Certificate, AuditEvent


class CertificateTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, self.attendances = fixtures()
        self.record = Contribution.objects.create(attendance=self.attendances[0], minutes=90, confirmed_by=self.owner)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.url = f'/api/v1/reports/activities/{self.activity.pk}/certificates/'

    def post(self, url, data):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url, data, format='json', HTTP_X_CSRFTOKEN=token)

    def issue(self):
        return issue_certificate(self.owner, self.activity.pk, self.attendances[0].pk)[0]

    def test_issue_retry_and_immutable_snapshot(self):
        response = self.post(self.url, {'attendance': str(self.attendances[0].pk)})
        self.assertEqual(response.status_code, 201, response.data)
        certificate = Certificate.objects.get()
        self.assertEqual(certificate.minutes, 90)
        self.assertEqual(self.post(self.url, {'attendance': str(self.attendances[0].pk)}).status_code, 200)
        self.assertEqual(Certificate.objects.count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='certificate_issued').count(), 1)
        self.one.full_name = 'Tên mới'
        self.one.save()
        self.activity.title = 'Hoạt động đổi tên'
        self.activity.save()
        certificate.refresh_from_db()
        self.assertEqual(certificate.volunteer_name, 'Một')
        self.assertEqual(certificate.activity_title, 'Trồng cây')

    def test_permissions_csrf_and_private_lists(self):
        self.assertEqual(self.client.post(self.url, {'attendance': str(self.attendances[0].pk)}, format='json').status_code, 403)
        certificate = self.issue()
        private = f'/api/v1/certificates/{certificate.pk}/'
        other = User.objects.create_user('certificate.other@example.invalid', role='organizer', full_name='Khác')
        self.client.force_login(other)
        self.assertEqual(self.post(self.url, {'attendance': str(self.attendances[0].pk)}).status_code, 403)
        self.assertEqual(self.client.get(private).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/certificates/').data['count'], 0)
        for user, expected in [(self.one, 200), (self.two, 404), (self.admin, 200)]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(private).status_code, expected)
        self.client.force_login(self.one)
        self.assertEqual(self.post(self.url, {'attendance': str(self.attendances[0].pk)}).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(private).status_code, 401)

    def test_public_verification_minimal_and_revocation_reissue(self):
        certificate = self.issue()
        url = f'/api/v1/certificates/{certificate.pk}/verify/'
        self.client.logout()
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {'id', 'volunteer_name', 'activity_title', 'organization_name', 'minutes', 'issued_at', 'status', 'revoked_at'})
        self.assertIn('no-store', response['Cache-Control'])
        self.assertIn('noindex', response['X-Robots-Tag'])
        revoke_certificate(self.admin, certificate.pk, 'Thông tin chưa đúng')
        revoke_certificate(self.owner, certificate.pk, 'Lặp không ghi đè')
        self.assertEqual(self.client.get(url).data['status'], 'revoked')
        certificate.refresh_from_db()
        self.assertEqual(certificate.revocation_reason, 'Thông tin chưa đúng')
        new, created = issue_certificate(self.admin, self.activity.pk, self.attendances[0].pk)
        self.assertTrue(created)
        self.assertNotEqual(new.pk, certificate.pk)
        self.assertEqual(Certificate.objects.filter(revoked_at__isnull=True).count(), 1)

    def test_eligibility_and_input_validation(self):
        self.assertEqual(self.post(self.url, {'attendance': str(self.attendances[1].pk)}).status_code, 400)
        self.record.minutes = 0
        self.record.save()
        self.assertEqual(self.post(self.url, {'attendance': str(self.attendances[0].pk)}).status_code, 400)
        self.record.minutes = 90
        self.record.save()
        for status in ['draft', 'published', 'cancelled']:
            self.activity.status = status
            self.activity.save()
            with self.assertRaises(ValidationError):
                self.issue()
        self.activity.status = 'completed'
        self.activity.ends_at = timezone.now() + timedelta(hours=1)
        self.activity.save()
        with self.assertRaises(ValidationError):
            self.issue()
        self.assertFalse(Certificate.objects.exists())

    def test_contribution_edit_revokes_but_noop_does_not(self):
        certificate = self.issue()
        values = {'minutes': 90, 'revision': 1, 'reason': ''}
        confirm(self.owner, self.activity.pk, self.attendances[0].pk, values)
        certificate.refresh_from_db()
        self.assertIsNone(certificate.revoked_at)
        confirm(self.owner, self.activity.pk, self.attendances[0].pk, {'minutes': 60, 'revision': 1, 'reason': 'Đối chiếu'})
        certificate.refresh_from_db()
        self.assertIsNotNone(certificate.revoked_at)
        self.assertEqual(certificate.minutes, 90)
        new = self.issue()
        self.assertEqual(new.minutes, 60)
        self.assertEqual(new.contribution_revision, 2)

    def test_audit_failure_rolls_back_issuance_and_contribution_revocation(self):
        with patch('apps.reports.certificate_services.record_certificate', side_effect=IntegrityError('audit')):
            with self.assertRaises(IntegrityError):
                self.issue()
        self.assertFalse(Certificate.objects.exists())
        certificate = self.issue()
        with patch('apps.reports.certificate_services.record_certificate', side_effect=IntegrityError('audit')):
            with self.assertRaises(IntegrityError):
                confirm(self.owner, self.activity.pk, self.attendances[0].pk, {'minutes': 60, 'revision': 1, 'reason': 'Đối chiếu'})
        self.record.refresh_from_db()
        certificate.refresh_from_db()
        self.assertEqual(self.record.minutes, 90)
        self.assertIsNone(certificate.revoked_at)

    def test_candidate_summary_filters_and_revoke_validation(self):
        response = self.client.get(f'/api/v1/reports/activities/{self.activity.pk}/certificate-candidates/')
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(sum(row['eligible'] for row in response.data['results']), 1)
        certificate = self.issue()
        self.assertEqual(self.post(f'/api/v1/certificates/{certificate.pk}/revoke/', {'reason': ' '}).status_code, 400)
        feedback = submit(self.activity.pk, self.one, {'rating': 5, 'content': 'Tốt'})
        hide(feedback.pk, self.admin, 'Kiểm tra')
        url = f'/api/v1/reports/activities/{self.activity.pk}/summary-document/'
        response = self.client.get(url)
        self.assertEqual(response.data['contributions'], {'minutes': 90, 'confirmed': 1, 'pending': 1})
        self.assertEqual(response.data['certificates'], 1)
        self.assertEqual(response.data['metrics']['feedback']['count'], 0)
        self.client.force_login(self.one)
        self.assertEqual(self.client.get(url).status_code, 403)
        for query in ['status=invalid', 'activity=invalid']:
            self.assertEqual(self.client.get('/api/v1/certificates/?' + query).status_code, 400)

    def test_database_guard_single_active_and_invalid_state(self):
        certificate = self.issue()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Certificate.objects.filter(pk=certificate.pk).update(active_attendance=None)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Certificate.objects.filter(pk=certificate.pk).update(minutes=0)


class CertificateConcurrencyTests(TransactionTestCase):
    def test_parallel_issue_creates_one_active_certificate(self):
        owner, _, _, _, activity, attendances = fixtures()
        Contribution.objects.create(attendance=attendances[0], minutes=60, confirmed_by=owner)
        barrier = Barrier(2)
        def issue(_):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return issue_certificate(owner, activity.pk, attendances[0].pk)[0].pk
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(issue, range(2)))
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(Certificate.objects.count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='certificate_issued').count(), 1)
