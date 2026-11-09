from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from ..models import Attendance, Contribution, Participation


@override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True)
class OrganizerOperationsTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('operations.owner@example.invalid', full_name='Tổ chức', role='organizer')
        self.other = User.objects.create_user('operations.other@example.invalid', full_name='Khác', role='organizer')
        now = timezone.now()
        self.activity = Activity.objects.create(organizer=self.owner, title='Cộng đồng', description='Nội dung',
            address='Huế', starts_at=now - timedelta(hours=3), ends_at=now - timedelta(hours=1),
            capacity=20, status='completed', published_at=now - timedelta(days=1))
        self.pending = self.entry('Chưa có mặt', 'pending-attendance@example.invalid')
        self.zero = self.entry('Đã chấm không', 'zero@example.invalid', attended=True, score=0)
        self.unscored = self.entry('Chưa chấm', 'unscored@example.invalid', attended=True)
        self.scored = self.entry('Đã chấm tám', 'scored@example.invalid', attended=True, score=8)
        self.cancelled = self.entry('Bằng chứng đã hủy', 'cancelled@example.invalid', status='cancelled', attended=True)
        self.entry('Đơn chưa duyệt', 'unapproved@example.invalid', status='pending')
        self.base = f'/api/v1/organizer/activities/{self.activity.pk}/'
        self.client.force_login(self.owner)

    def entry(self, name, email, status='approved', attended=False, score=None, activity=None):
        activity = activity or self.activity
        volunteer = User.objects.create_user(email, full_name=name)
        entry = Participation.objects.create(activity=activity, volunteer=volunteer, status=status,
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)
        if attended:
            attendance = Attendance.objects.create(participation=entry, confirmed_by=self.owner)
            if score is not None:
                Contribution.objects.create(attendance=attendance, score=score, confirmed_by=self.owner)
        return entry

    def get_data(self, endpoint, **query):
        response = self.client.get(self.base + endpoint + '/', query)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_attendance_summary_spans_pages_and_preserves_cancelled_evidence(self):
        data = self.get_data('attendance', page_size=1)
        self.assertEqual(data['count'], 5)
        self.assertEqual(len(data['results']), 1)
        self.assertIsNotNone(data['next'])
        self.assertEqual(data['summary'], {'total': 5, 'attended': 4, 'pending': 1})
        attended = self.get_data('attendance', status='attended')
        self.assertEqual(attended['count'], 4)
        self.assertIn(str(self.cancelled.pk), [row['id'] for row in attended['results']])
        pending = self.get_data('attendance', status='pending')
        self.assertEqual([row['id'] for row in pending['results']], [str(self.pending.pk)])
        self.assertEqual(pending['summary'], data['summary'])

    def test_attendance_search_is_server_side_and_summary_uses_search_before_status(self):
        self.assertEqual(self.get_data('attendance', search='PENDING-ATTENDANCE@')['count'], 1)
        data = self.get_data('attendance', search='chấm', status='pending', page_size=1)
        self.assertEqual(data['count'], 0)
        self.assertEqual(data['summary'], {'total': 3, 'attended': 3, 'pending': 0})
        self.assertEqual(self.get_data('attendance', search='không tồn tại')['summary'], {'total': 0, 'attended': 0, 'pending': 0})

    def test_contribution_summary_counts_zero_as_confirmed_and_prioritizes_unscored(self):
        data = self.get_data('contributions', page_size=1)
        self.assertEqual(data['count'], 3)
        self.assertIsNone(data['results'][0]['contribution'])
        self.assertEqual(data['summary'], {'total': 3, 'score': 8, 'confirmed': 2, 'pending': 1})
        pending = self.get_data('contributions', status='pending', page_size=1)
        self.assertEqual(pending['count'], 1)
        self.assertEqual(pending['summary'], data['summary'])
        confirmed = self.get_data('contributions', status='confirmed')
        self.assertEqual(confirmed['count'], 2)
        self.assertCountEqual([row['contribution']['score'] for row in confirmed['results']], [0, 8])

    def test_contribution_search_and_filters_keep_volunteer_summary_shape(self):
        data = self.get_data('contributions', search='ZERO@', status='pending')
        self.assertEqual(data['count'], 0)
        self.assertEqual(data['summary'], {'total': 1, 'score': 0, 'confirmed': 1, 'pending': 0})
        self.assertEqual(self.get_data('contributions', search='Chưa chấm')['count'], 1)
        self.client.force_login(self.zero.volunteer)
        response = self.client.get('/api/v1/contributions/', {'status': 'pending', 'search': 'Cộng đồng'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['summary'], {'score': 0, 'confirmed': 1, 'pending': 0})

    def test_contributions_still_exclude_cancelled_unattended_and_unfinished(self):
        self.assertEqual(self.get_data('contributions')['count'], 3)
        Activity.objects.filter(pk=self.activity.pk).update(status='published')
        self.assertEqual(self.get_data('contributions')['summary'], {'total': 0, 'score': 0, 'confirmed': 0, 'pending': 0})
        Activity.objects.filter(pk=self.activity.pk).update(status='completed', ends_at=timezone.now() + timedelta(hours=2))
        self.assertEqual(self.get_data('contributions')['count'], 0)
        with override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False):
            self.assertEqual(self.get_data('contributions')['count'], 3)

    def test_invalid_filters_and_page_are_rejected(self):
        for endpoint in ['attendance', 'contributions']:
            for query, expected in [({'status': 'forged'}, 400), ({'search': 'a' * 201}, 400), ({'page': 999}, 404)]:
                with self.subTest(endpoint=endpoint, query=query):
                    self.assertEqual(self.client.get(self.base + endpoint + '/', query).status_code, expected)

    def test_summaries_are_scoped_to_activity_and_owner(self):
        other_activity = Activity.objects.create(organizer=self.other, title='Khác', description='Khác', address='Huế',
            starts_at=self.activity.starts_at, ends_at=self.activity.ends_at, capacity=2, status='completed')
        self.entry('Người ngoài', 'foreign@example.invalid', attended=True, score=10, activity=other_activity)
        self.assertEqual(self.get_data('attendance')['summary']['total'], 5)
        self.assertEqual(self.get_data('contributions')['summary']['score'], 8)
        self.client.force_login(self.other)
        for endpoint in ['attendance', 'contributions']:
            self.assertEqual(self.client.get(self.base + endpoint + '/').status_code, 404)
        self.client.force_login(self.pending.volunteer)
        for endpoint in ['attendance', 'contributions']:
            self.assertEqual(self.client.get(self.base + endpoint + '/').status_code, 403)
        self.client.logout()
        for endpoint in ['attendance', 'contributions']:
            self.assertEqual(self.client.get(self.base + endpoint + '/').status_code, 401)
