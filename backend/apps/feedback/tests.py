from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.core.cache import cache
from django.db import IntegrityError, connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Attendance, Participation
from .models import Feedback
from . import services


def fixtures():
    owner = User.objects.create_user('feedback.org@example.invalid', full_name='Tổ chức', role='organizer')
    one = User.objects.create_user('feedback.one@example.invalid', full_name='Một')
    two = User.objects.create_user('feedback.two@example.invalid', full_name='Hai')
    admin = User.objects.create_superuser('feedback.admin', full_name='Quản trị')
    now = timezone.now()
    activity = Activity.objects.create(organizer=owner, title='Trồng cây', description='Cộng đồng', address='Huế',
        starts_at=now - timedelta(days=2), ends_at=now - timedelta(days=1), capacity=2, status='completed', published_at=now - timedelta(days=3))
    records = []
    for user in [one, two]:
        entry = Participation.objects.create(activity=activity, volunteer=user, status='approved',
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)
        records.append(Attendance.objects.create(participation=entry, confirmed_by=owner))
    return owner, one, two, admin, activity, records


class FeedbackTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, self.records = fixtures()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.one)
        self.url = f'/api/v1/activities/{self.activity.pk}/feedback/'
        self.organizer_url = f'/api/v1/organizer/activities/{self.activity.pk}/feedback/'

    def post(self, url=None, data=None):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url or self.url, {'rating': 5, 'content': 'Rất hữu ích'} if data is None else data,
                                format='json', HTTP_X_CSRFTOKEN=token)

    def test_submit_once_read_own_and_no_edit_delete(self):
        self.assertTrue(self.client.get(self.url).data['can_submit'])
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 400)
        own = self.client.get(self.url).data
        self.assertFalse(own['can_submit'])
        self.assertEqual(own['feedback']['rating'], 5)
        self.client.force_login(self.two)
        self.assertIsNone(self.client.get(self.url).data['feedback'])
        self.client.force_login(self.one)
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        for method in [self.client.patch, self.client.delete]:
            self.assertEqual(method(self.url, {}, format='json', HTTP_X_CSRFTOKEN=token).status_code, 405)
        self.assertEqual(Feedback.objects.count(), 1)

    def test_attendance_and_approved_registration_required(self):
        self.records[0].delete()
        self.assertFalse(self.client.get(self.url).data['can_submit'])
        self.assertEqual(self.post().status_code, 400)
        self.client.force_login(self.two)
        for status in ['pending', 'rejected', 'cancelled']:
            Participation.objects.filter(pk=self.records[1].participation_id).update(status=status)
            self.assertEqual(self.post().status_code, 400)

    def test_activity_must_be_completed_and_ended(self):
        for status in ['draft', 'published', 'cancelled']:
            Activity.objects.filter(pk=self.activity.pk).update(status=status)
            self.assertFalse(self.client.get(self.url).data['can_submit'])
            self.assertEqual(self.post().status_code, 400)
        Activity.objects.filter(pk=self.activity.pk).update(status='completed', ends_at=timezone.now() + timedelta(days=1))
        self.assertEqual(self.post().status_code, 400)
        Activity.objects.filter(pk=self.activity.pk).update(published_at=None)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_rating_content_and_unknown_fields_validation(self):
        for data in [{'rating': 0, 'content': 'A'}, {'rating': 6, 'content': 'A'}, {'rating': 2.5, 'content': 'A'},
                     {'rating': 5, 'content': '   '}, {'rating': 5, 'content': 'x' * 2001}, {'rating': 5},
                     {'rating': 5, 'content': 'A', 'attendance': str(self.records[1].pk)},
                     {'rating': 5, 'content': 'A', 'is_hidden': False}]:
            with self.subTest(data=data):
                self.assertEqual(self.post(data=data).status_code, 400)
        self.assertEqual(self.post(data={'rating': 1, 'content': '  ' + 'x' * 2000 + '  '}).status_code, 201)
        self.assertEqual(len(Feedback.objects.get().content), 2000)

    def test_csrf_roles_and_owner_scoping(self):
        self.assertEqual(self.client.post(self.url, {'rating': 5, 'content': 'A'}, format='json').status_code, 403)
        self.assertEqual(self.client.get(self.organizer_url).status_code, 403)
        self.assertEqual(self.client.get('/api/v1/admin/feedback/').status_code, 403)
        other = User.objects.create_user('other@example.invalid', role='organizer', full_name='Khác')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.organizer_url).status_code, 404)
        self.assertEqual(self.post().status_code, 403)
        self.client.force_login(self.admin)
        self.assertEqual(self.post().status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.get('/api/v1/admin/feedback/').status_code, 401)

    def test_hiding_excludes_content_and_rating_from_organizer_statistics(self):
        first = services.submit(self.activity.pk, self.one, {'rating': 5, 'content': 'Nội dung một'})
        second = services.submit(self.activity.pk, self.two, {'rating': 1, 'content': 'Nội dung hai'})
        self.client.force_login(self.owner)
        before = self.client.get(self.organizer_url + '?page_size=1').data
        self.assertEqual(before['summary'], {'count': 2, 'average_rating': 3.0})
        self.client.force_login(self.admin)
        url = f'/api/v1/admin/feedback/{first.pk}/hide/'
        self.assertEqual(self.post(url, {'reason': 'Không phù hợp'}).status_code, 200)
        first.refresh_from_db()
        self.assertEqual(first.hidden_by, self.admin)
        self.assertIsNotNone(first.hidden_at)
        self.client.force_login(self.owner)
        after = self.client.get(self.organizer_url).data
        self.assertEqual(after['summary'], {'count': 1, 'average_rating': 1.0})
        self.assertEqual(after['results'][0]['id'], str(second.pk))
        self.assertNotIn('Nội dung một', str(after))
        services.hide(second.pk, self.admin, 'Lý do')
        self.assertEqual(self.client.get(self.organizer_url).data['summary'], {'count': 0, 'average_rating': None})
        self.client.force_login(self.one)
        own = self.client.get(self.url).data
        self.assertTrue(own['feedback']['is_hidden'])
        self.assertEqual(own['feedback']['hidden_reason'], 'Không phù hợp')
        self.assertEqual(self.post().status_code, 400)

    def test_hide_requires_admin_csrf_reason_and_preserves_first_audit(self):
        entry = services.submit(self.activity.pk, self.one, {'rating': 4, 'content': 'Nội dung'})
        url = f'/api/v1/admin/feedback/{entry.pk}/hide/'
        self.assertEqual(self.post(url, {'reason': 'Lý do'}).status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.post(url, {'reason': 'Lý do'}).status_code, 403)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(url, {'reason': 'Lý do'}, format='json').status_code, 403)
        for payload in [{}, {'reason': '  '}, {'reason': 'x' * 1001}, {'reason': 'A', 'hidden_by': str(self.one.pk)}]:
            self.assertEqual(self.post(url, payload).status_code, 400)
        first = self.post(url, {'reason': 'Lần đầu'}).data
        second_admin = User.objects.create_superuser('another.admin')
        self.client.force_login(second_admin)
        again = self.post(url, {'reason': 'Lần sau'}).data
        self.assertEqual(first, again)

    def test_admin_filter_and_no_private_email_in_output(self):
        entry = services.submit(self.activity.pk, self.one, {'rating': 3, 'content': 'Nội dung'})
        self.client.force_login(self.admin)
        response = self.client.get('/api/v1/admin/feedback/?status=visible')
        self.assertEqual(response.data['count'], 1)
        self.assertNotIn('email', response.data['results'][0])
        self.assertIn('no-store', response['Cache-Control'])
        services.hide(entry.pk, self.admin, 'Lý do')
        self.assertEqual(self.client.get('/api/v1/admin/feedback/?status=visible').data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/admin/feedback/?status=hidden').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/admin/feedback/?status=bad').status_code, 400)

    def test_database_constraints(self):
        entry = services.submit(self.activity.pk, self.one, {'rating': 5, 'content': 'A'})
        with self.assertRaises(IntegrityError), transaction.atomic():
            Feedback.objects.create(attendance=entry.attendance, rating=5, content='Trùng')
        for values in [{'rating': 0}, {'rating': 6}, {'is_hidden': True}, {'content': ''}]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                Feedback.objects.filter(pk=entry.pk).update(**values)


class FeedbackConcurrencyTests(TransactionTestCase):
    def test_concurrent_submission_creates_one_feedback(self):
        _, one, _, _, activity, _ = fixtures()
        barrier = Barrier(2)
        def submit(_):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                services.submit(activity.pk, one, {'rating': 5, 'content': 'Hữu ích'})
                return 'created'
            except ValidationError:
                return 'duplicate'
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertCountEqual(list(pool.map(submit, range(2))), ['created', 'duplicate'])
        self.assertEqual(Feedback.objects.count(), 1)
