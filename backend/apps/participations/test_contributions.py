from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.notifications.models import Notification
from .models import Attendance, Participation, Contribution, ContributionChange


class ContributionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('contrib.owner@example.invalid', role='organizer', full_name='Tổ chức')
        self.volunteer = User.objects.create_user('contrib.vol@example.invalid', full_name='Người tham gia')
        self.other = User.objects.create_user('contrib.other@example.invalid', role='organizer', full_name='Tổ chức khác')
        now = timezone.now()
        self.activity = Activity.objects.create(organizer=self.owner, title='Đóng góp', description='Nội dung', address='Huế',
            starts_at=now-timedelta(hours=3), ends_at=now-timedelta(hours=1), capacity=10, status='completed', published_at=now-timedelta(days=2))
        self.entry = Participation.objects.create(activity=self.activity, volunteer=self.volunteer, status='approved',
            registered_starts_at=self.activity.starts_at, registered_ends_at=self.activity.ends_at, registered_address='Huế')
        self.attendance = Attendance.objects.create(participation=self.entry, confirmed_by=self.owner)
        self.list_url = f'/api/v1/organizer/activities/{self.activity.pk}/contributions/'
        self.url = f'{self.list_url}{self.attendance.pk}/'
        self.history = f'/api/v1/contributions/{self.attendance.pk}/history/'
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)

    def save(self, score=8, revision=0, reason=''):
        csrf = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(self.url, dict(score=score, revision=revision, reason=reason), format='json', HTTP_X_CSRFTOKEN=csrf)

    def test_confirm_adjust_and_personal_total_history(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.data['count'], 1)
        self.assertIsNone(response.data['results'][0]['contribution'])
        self.assertEqual(self.save().status_code, 200)
        self.assertEqual(self.save(10, 1, 'Đối chiếu đóng góp thực tế').status_code, 200)
        self.client.force_login(self.volunteer)
        data = self.client.get('/api/v1/contributions/?page_size=1').data
        self.assertEqual(data['summary'], {'score': 10, 'confirmed': 1, 'pending': 0})
        changes = self.client.get(self.history).data['results']
        self.assertEqual([c['score'] for c in changes], [10, 8])
        self.assertEqual(changes[0]['previous_score'], 8)
        self.assertEqual(changes[0]['reason'], 'Đối chiếu đóng góp thực tế')
        self.assertEqual(Notification.objects.filter(recipient=self.volunteer).count(), 2)

    def test_limits_reason_and_stale_revision_do_not_write(self):
        for value in [-1, 11, 1.5, 'bad', True]:
            self.assertEqual(self.save(value).status_code, 400)
        self.assertFalse(Contribution.objects.exists())
        self.assertEqual(self.save(10).status_code, 200)
        self.assertEqual(self.save(6, 1).status_code, 400)
        self.assertEqual(self.save(6, 0, 'Phiên cũ').status_code, 400)
        self.assertEqual(self.save(10, 1).status_code, 200)
        self.assertEqual(ContributionChange.objects.count(), 1)
        self.assertEqual(self.save(0, 1, 'Không công nhận sau đối chiếu').status_code, 200)
        self.assertEqual(Contribution.objects.get().score, 0)

    def test_only_owner_writes_and_personal_history_is_private(self):
        self.assertEqual(self.client.post(self.url, {'score': 8, 'revision': 0}, format='json').status_code, 403)
        self.client.force_login(self.other)
        self.assertEqual(self.save().status_code, 404)
        self.assertEqual(self.client.get(self.list_url).status_code, 404)
        self.assertEqual(self.client.get(self.history).status_code, 404)
        self.client.force_login(self.volunteer)
        self.assertEqual(self.save().status_code, 403)
        unrelated = User.objects.create_user('contrib.unrelated@example.invalid', full_name='Người khác')
        self.client.force_login(unrelated)
        self.assertEqual(self.client.get(self.history).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/contributions/').data['count'], 0)
        self.client.logout()
        self.assertEqual(self.client.get('/api/v1/contributions/').status_code, 401)

    def test_requires_completed_ended_and_approved_attendance(self):
        for status in ['draft', 'published', 'cancelled']:
            Activity.objects.filter(pk=self.activity.pk).update(status=status)
            self.assertEqual(self.save().status_code, 400)
            self.assertEqual(self.client.get(self.list_url).data['count'], 0)
        Activity.objects.filter(pk=self.activity.pk).update(status='completed', ends_at=timezone.now()+timedelta(hours=1))
        self.assertEqual(self.save().status_code, 400)
        Activity.objects.filter(pk=self.activity.pk).update(ends_at=self.activity.ends_at)
        Participation.objects.filter(pk=self.entry.pk).update(status='cancelled')
        self.assertEqual(self.save().status_code, 404)
        self.assertFalse(Contribution.objects.exists())

    def test_notification_failure_rolls_back_confirmation_and_history(self):
        self.client.raise_request_exception = False
        with patch('apps.participations.contributions.notify', side_effect=RuntimeError('Test rollback')):
            self.assertEqual(self.save().status_code, 500)
        self.assertFalse(Contribution.objects.exists())
        self.assertFalse(ContributionChange.objects.exists())

    def test_summary_counts_all_pages_and_pending_is_not_zero_confirmed(self):
        second = Activity.objects.create(organizer=self.owner, title='Thứ hai', description='Nội dung', address='Huế',
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at, capacity=5, status='completed')
        entry = Participation.objects.create(activity=second, volunteer=self.volunteer, status='approved',
            registered_starts_at=second.starts_at, registered_ends_at=second.ends_at, registered_address='Huế')
        Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        self.assertEqual(self.save(0).status_code, 200)
        self.client.force_login(self.volunteer)
        data = self.client.get('/api/v1/contributions/?page_size=1').data
        self.assertEqual(data['count'], 2)
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['summary'], {'score': 0, 'confirmed': 1, 'pending': 1})

    def test_total_adds_scores_across_activities_without_ten_point_cap(self):
        self.assertEqual(self.save(10).status_code, 200)
        second = Activity.objects.create(organizer=self.owner, title='Hoạt động khác', description='Nội dung', address='Huế',
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at, capacity=5, status='completed')
        entry = Participation.objects.create(activity=second, volunteer=self.volunteer, status='approved',
            registered_starts_at=second.starts_at, registered_ends_at=second.ends_at, registered_address='Huế')
        attendance = Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        Contribution.objects.create(attendance=attendance, score=8, confirmed_by=self.owner)
        self.client.force_login(self.volunteer)
        self.assertEqual(self.client.get('/api/v1/contributions/?page_size=1').data['summary'],
                         {'score': 18, 'confirmed': 2, 'pending': 0})

    def test_old_minutes_payload_is_rejected_and_database_limits_are_enforced(self):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        self.assertEqual(self.client.post(self.url, {'minutes': 90, 'revision': 0}, format='json', HTTP_X_CSRFTOKEN=token).status_code, 400)
        self.assertEqual(self.save(10).status_code, 200)
        record = Contribution.objects.get()
        for value in [-1, 11]:
            with self.assertRaises(DatabaseError), transaction.atomic():
                Contribution.objects.filter(pk=record.pk).update(score=value)
            with self.assertRaises(DatabaseError), transaction.atomic():
                ContributionChange.objects.filter(contribution=record).update(score=value)
            with self.assertRaises(DatabaseError), transaction.atomic():
                ContributionChange.objects.filter(contribution=record).update(previous_score=value)
