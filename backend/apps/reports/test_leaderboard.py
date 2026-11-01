import tempfile
from datetime import timedelta
from io import BytesIO

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.contributions import confirm
from apps.participations.models import Attendance, Contribution, Participation
from .leaderboard import level_for


class LevelTests(SimpleTestCase):
    def test_every_level_boundary_and_progress(self):
        for score, name in [(0, 'Khởi đầu'), (19, 'Khởi đầu'), (20, 'Đồng hành'), (49, 'Đồng hành'),
                            (50, 'Tích cực'), (99, 'Tích cực'), (100, 'Tiên phong'), (199, 'Tiên phong'),
                            (200, 'Truyền cảm hứng'), (999, 'Truyền cảm hứng')]:
            with self.subTest(score=score):
                self.assertEqual(level_for(score)['name'], name)
        self.assertEqual(level_for(0)['progress'], 0)
        self.assertEqual(level_for(10)['progress'], 50)
        self.assertEqual(level_for(20)['progress'], 0)
        self.assertEqual(level_for(200)['progress'], 100)
        self.assertIsNone(level_for(200)['next_min_score'])


class LeaderboardTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('leader.org@example.invalid', role='organizer', full_name='Tổ chức')
        self.one = self.volunteer('one')
        self.two = self.volunteer('two')
        self.client.force_login(self.one)
        self.url = '/api/v1/leaderboard/'

    def volunteer(self, name):
        return User.objects.create_user(f'leader.{name}@example.invalid', full_name=name, phone='0912345678', bio='Riêng tư')

    def contribution(self, user, score, **changes):
        now = timezone.now()
        values = dict(organizer=self.owner, title='Hoạt động đóng góp', description='Mô tả riêng', address='Huế',
                      status='completed', starts_at=now-timedelta(days=2), ends_at=now-timedelta(days=1), capacity=50)
        values.update(changes)
        activity = Activity.objects.create(**values)
        entry = Participation.objects.create(activity=activity, volunteer=user, status='approved',
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)
        attendance = Attendance.objects.create(participation=entry, confirmed_by=self.owner)
        record = Contribution.objects.create(attendance=attendance, score=score, confirmed_by=self.owner)
        return record

    def test_totals_ties_levels_and_personal_summary_match(self):
        self.contribution(self.one, 10)
        self.contribution(self.one, 10)
        self.contribution(self.two, 10)
        self.contribution(self.two, 10)
        third = self.volunteer('third')
        self.contribution(third, 8)
        data = self.client.get(self.url).data
        self.assertEqual([r['rank'] for r in data['results']], [1, 1, 3])
        self.assertEqual(data['me']['total_score'], 20)
        self.assertEqual(data['me']['level']['name'], 'Đồng hành')
        self.assertTrue(data['me']['is_me'])
        personal = self.client.get('/api/v1/contributions/').data
        self.assertEqual(data['me']['total_score'], personal['summary']['score'])

    def test_only_eligible_completed_attendance_and_active_volunteers(self):
        self.contribution(self.one, 6)
        for status in ['draft', 'published', 'cancelled']:
            self.contribution(self.one, 10, status=status)
        self.contribution(self.one, 10, starts_at=timezone.now(), ends_at=timezone.now()+timedelta(hours=1))
        record = self.contribution(self.one, 10)
        record.attendance.participation.status = 'cancelled'
        record.attendance.participation.save(update_fields=['status'])
        self.contribution(self.two, 10)
        self.two.is_active = False
        self.two.save(update_fields=['is_active'])
        data = self.client.get(self.url).data
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['me']['total_score'], 6)
        self.assertEqual(data['me']['total_score'], self.client.get('/api/v1/contributions/').data['summary']['score'])

    def test_exact_twenty_stable_cutoff_and_self_outside_board(self):
        joined = timezone.now() - timedelta(days=100)
        for i in range(23):
            user = self.volunteer(f'tie-{i:02}')
            User.objects.filter(pk=user.pk).update(date_joined=joined + timedelta(seconds=i))
            self.contribution(user, 10)
        self.contribution(self.one, 1)
        first = self.client.get(self.url).data
        second = self.client.get(self.url).data
        self.assertEqual(len(first['results']), 20)
        self.assertEqual([r['full_name'] for r in first['results']], [f'tie-{i:02}' for i in range(20)])
        self.assertEqual(first['results'], second['results'])
        self.assertEqual({r['rank'] for r in first['results']}, {1})
        self.assertEqual(first['me']['rank'], 24)
        self.assertEqual(first['me']['total_score'], 1)

    def test_zero_ungraded_and_empty_board(self):
        self.contribution(self.one, 0)
        data = self.client.get(self.url).data
        self.assertEqual(data['results'], [])
        self.assertIsNone(data['me']['rank'])
        self.assertEqual(data['me']['total_score'], 0)
        self.assertEqual(data['me']['level']['name'], 'Khởi đầu')
        self.client.force_login(self.two)
        self.assertIsNone(self.client.get(self.url).data['me']['rank'])

    def test_score_edit_recalculates_rank_and_level_and_is_not_cached(self):
        self.contribution(self.one, 10)
        change = self.contribution(self.one, 10)
        self.contribution(self.two, 10)
        self.contribution(self.two, 9)
        self.assertEqual(self.client.get(self.url).data['me']['rank'], 1)
        confirm(self.owner, change.attendance.participation.activity_id, change.attendance_id,
                {'score': 8, 'revision': 1, 'reason': 'Đối chiếu'})
        response = self.client.get(self.url)
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(response.data['me']['rank'], 2)
        self.assertEqual(response.data['me']['total_score'], 18)
        self.assertEqual(response.data['me']['level']['name'], 'Khởi đầu')

    def test_permissions_minimal_fields_and_read_only(self):
        self.contribution(self.one, 7)
        for user in [self.one, self.owner, User.objects.create_superuser('rankadmin')]:
            self.client.force_login(user)
            result = self.client.get(self.url)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(set(result.data['results'][0]), {'rank', 'full_name', 'avatar_url', 'total_score', 'level', 'is_me'})
            self.assertNotIn('Riêng tư', str(result.data))
            self.assertNotIn('@example.invalid', str(result.data))
            self.assertNotIn('0912345678', str(result.data))
            if user.role != 'volunteer':
                self.assertIsNone(result.data['me'])
            self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 405)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_avatar_is_authenticated_scoped_and_no_store(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            output = BytesIO()
            Image.new('RGB', (16, 16), 'green').save(output, 'JPEG')
            self.one.avatar.save('rank.jpg', ContentFile(output.getvalue()))
            self.contribution(self.one, 8)
            response = self.client.get(self.url)
            url = response.data['results'][0]['avatar_url']
            avatar = self.client.get(url)
            self.assertEqual(avatar.status_code, 200)
            self.assertEqual(avatar['Content-Type'], 'image/jpeg')
            self.assertIn('no-store', avatar['Cache-Control'])
            self.assertTrue(b''.join(avatar.streaming_content).startswith(b'\xff\xd8'))
            self.assertEqual(self.client.get(f'/api/v1/leaderboard/avatars/{self.two.pk}/').status_code, 404)
            self.client.logout()
            self.assertEqual(self.client.get(url).status_code, 401)
            self.client.force_login(self.two)
            self.one.is_active = False
            self.one.save(update_fields=['is_active'])
            self.assertEqual(self.client.get(url).status_code, 404)
