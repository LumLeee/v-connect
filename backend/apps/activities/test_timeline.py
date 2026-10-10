from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from .models import Activity, ActivityMilestone


class TimelineTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('timeline.org@example.invalid', role='organizer', full_name='Tổ chức')
        self.other = User.objects.create_user('timeline.other@example.invalid', role='organizer', full_name='Khác')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.start = timezone.now() + timedelta(days=3)
        self.activity = Activity.objects.create(organizer=self.owner, title='Chương trình', description='Nội dung',
            address='Huế', capacity=20, starts_at=self.start, ends_at=self.start + timedelta(hours=4))
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/'

    def item(self, hour=0, **changes):
        data = dict(title=f'Mốc {hour}', description='Chi tiết', starts_at=(self.start + timedelta(hours=hour)).isoformat(),
                    ends_at=(self.start + timedelta(hours=hour + 1)).isoformat())
        data.update(changes)
        return data

    def update(self, data):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.patch(self.url, data, format='json', HTTP_X_CSRFTOKEN=token)

    def test_sort_partial_preserve_replace_clear_and_public_visibility(self):
        response = self.update({'timeline': [self.item(2), self.item(0)]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['title'] for row in response.data['timeline']], ['Mốc 0', 'Mốc 2'])
        self.assertEqual(len(self.update({'title': 'Tên mới'}).data['timeline']), 2)
        public = f'/api/v1/activities/{self.activity.pk}/'
        self.assertEqual(self.client.get(public).status_code, 404)
        self.activity.status = 'published'
        self.activity.published_at = timezone.now()
        self.activity.save()
        self.client.logout()
        self.assertEqual(len(self.client.get(public).data['timeline']), 2)
        self.client.force_login(self.owner)
        self.assertEqual(len(self.update({'timeline': [self.item(1)]}).data['timeline']), 1)
        self.assertEqual(self.update({'timeline': []}).data['timeline'], [])

    def test_invalid_milestones_do_not_change_activity(self):
        for items in [[self.item(-1)], [self.item(4)], [self.item(ends_at=self.start.isoformat())],
                      [self.item(title='')], [self.item(description='x' * 2001)], [self.item()] * 51,
                      [{'title': 'Thiếu giờ'}], [self.item(activity=str(self.activity.pk))], None]:
            with self.subTest(items=items):
                self.assertEqual(self.update({'title': 'Không lưu', 'timeline': items}).status_code, 400)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, 'Chương trình')
        self.assertFalse(ActivityMilestone.objects.exists())

    def test_changed_activity_dates_require_consistent_timeline(self):
        self.update({'timeline': [self.item(0)]})
        new_start = self.start + timedelta(days=1)
        dates = {'starts_at': new_start.isoformat(), 'ends_at': (new_start + timedelta(hours=4)).isoformat()}
        self.assertEqual(self.update(dates).status_code, 400)
        self.assertEqual(self.update({**dates, 'timeline': [self.item(starts_at=new_start.isoformat(), ends_at=(new_start + timedelta(hours=1)).isoformat())]}).status_code, 200)

    def test_permission_csrf_and_closed_activity(self):
        self.assertEqual(self.client.patch(self.url, {'timeline': []}, format='json').status_code, 403)
        self.client.force_login(self.other)
        self.assertEqual(self.update({'timeline': [self.item()]}).status_code, 404)
        volunteer = User.objects.create_user('timeline.vol@example.invalid', full_name='Tình nguyện viên')
        self.client.force_login(volunteer)
        self.assertEqual(self.update({'timeline': []}).status_code, 403)
        self.client.force_login(self.owner)
        for status in ['completed', 'cancelled']:
            self.activity.status = status
            self.activity.save()
            self.assertEqual(self.update({'timeline': []}).status_code, 400)

    def test_write_failure_rolls_back_deleted_milestones_and_basic_fields(self):
        self.update({'timeline': [self.item()]})
        with patch('apps.activities.serializers.ActivityMilestone.objects.bulk_create', side_effect=IntegrityError('rollback')):
            self.assertEqual(self.update({'title': 'Không lưu', 'timeline': [self.item(1)]}).status_code, 500)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, 'Chương trình')
        self.assertEqual(self.activity.timeline.get().title, 'Mốc 0')

    def test_create_with_timeline_and_parallel_milestones(self):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        response = self.client.post('/api/v1/organizer/activities/', {
            'title': 'Mới', 'description': 'Nội dung', 'address': 'Huế', 'capacity': 10,
            'starts_at': self.start.isoformat(), 'ends_at': (self.start + timedelta(hours=4)).isoformat(),
            'timeline': [self.item(), self.item(title='Song song')],
        }, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data['timeline']), 2)
