from datetime import datetime, timedelta, timezone as tz
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.core.models import Skill
from .models import Activity


class ActivityExtensionTests(APITestCase):
    url = '/api/v1/organizer/activities/'

    def setUp(self):
        cache.clear()
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.media = Path(directory.name)
        settings = override_settings(MEDIA_ROOT=directory.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.owner = User.objects.create_user('extension@example.invalid', 'River-Community-493!', full_name='Nhà tổ chức', role='organizer')
        self.other = User.objects.create_user('other-extension@example.invalid', 'River-Community-493!', full_name='Nhà tổ chức', role='organizer')
        self.volunteer = User.objects.create_user('vol-extension@example.invalid', 'River-Community-493!', full_name='Tình nguyện viên')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.skills = [Skill.objects.create(name='Giao tiếp', slug='extension-communication'),
                       Skill.objects.create(name='Sơ cứu', slug='extension-first-aid')]
        self.start = timezone.now() + timedelta(days=2)
        self.payload = dict(title='Trồng cây', description='Chung tay', address='Huế', capacity=10,
                            starts_at=self.start.isoformat(), ends_at=(self.start + timedelta(hours=2)).isoformat())
        self.activity = Activity.objects.create(organizer=self.owner, **self.payload)
        self.detail = f'{self.url}{self.activity.pk}/'
        self.cover = f'/api/v1/activities/{self.activity.pk}/cover/'

    def headers(self):
        return {'HTTP_X_CSRFTOKEN': self.client.get('/api/v1/auth/csrf/').data['csrfToken']}

    def mutate(self, method, url, data):
        return getattr(self.client, method)(url, data, format='json', **self.headers())

    def picture(self, color='red', size=(2000, 1000), fmt='PNG'):
        stream = BytesIO()
        Image.new('RGB', size, color).save(stream, format=fmt)
        return SimpleUploadedFile('../../original.png', stream.getvalue(), content_type='image/png')

    def upload(self, file=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.cover, {'cover': file or self.picture()}, format='multipart', **self.headers())

    def publish(self):
        Activity.objects.filter(pk=self.activity.pk).update(status='published', published_at=timezone.now())

    def test_skills_create_edit_clear_and_invalid_inputs_are_atomic(self):
        ids = [skill.pk for skill in self.skills]
        result = self.mutate('post', self.url, {**self.payload, 'required_skills': ids})
        self.assertEqual(result.status_code, 201, result.data)
        self.assertCountEqual(result.data['required_skills'], ids)
        self.assertCountEqual([item['name'] for item in result.data['skill_details']], [s.name for s in self.skills])
        self.assertEqual(self.mutate('patch', self.detail, {'required_skills': ids}).status_code, 200)
        for value in [[ids[0], ids[0]], [999999], None, 'abc']:
            response = self.mutate('patch', self.detail, {'title': 'Không lưu', 'required_skills': value})
            self.assertEqual(response.status_code, 400, response.data)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, self.payload['title'])
        self.assertCountEqual(self.activity.required_skills.values_list('pk', flat=True), ids)
        self.assertEqual(self.mutate('patch', self.detail, {'required_skills': []}).status_code, 200)
        self.assertFalse(self.activity.required_skills.exists())
        extra = [Skill.objects.create(name=f'Skill {i}', slug=f'extension-{i}').pk for i in range(21)]
        self.assertEqual(self.mutate('post', self.url, {**self.payload, 'required_skills': extra}).status_code, 400)

    def test_skills_do_not_bypass_owner_or_terminal_state(self):
        self.client.force_login(self.other)
        self.assertEqual(self.mutate('patch', self.detail, {'required_skills': [self.skills[0].pk]}).status_code, 404)
        self.client.force_login(self.owner)
        for status in ['completed', 'cancelled']:
            Activity.objects.filter(pk=self.activity.pk).update(status=status)
            self.assertEqual(self.mutate('patch', self.detail, {'required_skills': [self.skills[0].pk]}).status_code, 400)

    def test_filters_combine_before_pagination_and_keep_drafts_private(self):
        self.publish()
        self.activity.required_skills.set(self.skills)
        for hour in [1, 2]:
            activity = Activity.objects.create(organizer=self.owner, **{**self.payload,
                'starts_at': self.start + timedelta(hours=hour), 'ends_at': self.start + timedelta(hours=4)},
                status='published', published_at=timezone.now())
            activity.required_skills.add(self.skills[0])
        Activity.objects.create(organizer=self.other, **self.payload).required_skills.add(self.skills[0])
        query = dict(status='published', search='Trồng', location='Huế', skill=self.skills[0].pk, page_size=1)
        guest = APIClient()
        result = guest.get('/api/v1/activities/', query)
        self.assertEqual(result.data['count'], 3)
        self.assertEqual(len(result.data['results']), 1)
        self.assertIsNotNone(result.data['next'])
        self.assertEqual(guest.get('/api/v1/activities/', {**query, 'skill': self.skills[1].pk}).data['count'], 1)
        self.assertEqual(guest.get('/api/v1/activities/', {**query, 'location': 'Hà Nội'}).data['count'], 0)
        self.assertEqual(self.client.get(self.url, {'status': 'draft'}).data['count'], 0)
        for query in [{'status': 'draft'}, {'status': 'bad'}, {'date_from': 'bad'},
                      {'date_from': '2027-02-02', 'date_to': '2027-02-01'}, {'skill': 999999}, {'location': 'x' * 201}]:
            self.assertEqual(guest.get('/api/v1/activities/', query).status_code, 400)

    def test_date_filters_include_entire_vietnam_day(self):
        self.publish()
        for start, expected in [(datetime(2027, 1, 1, 16, 59, 59, tzinfo=tz.utc), 0),
                                (datetime(2027, 1, 1, 17, tzinfo=tz.utc), 1),
                                (datetime(2027, 1, 2, 16, 59, 59, 999999, tzinfo=tz.utc), 1),
                                (datetime(2027, 1, 2, 17, tzinfo=tz.utc), 0)]:
            Activity.objects.filter(pk=self.activity.pk).update(starts_at=start, ends_at=start + timedelta(hours=1))
            response = APIClient().get('/api/v1/activities/', {'date_from': '2027-01-02', 'date_to': '2027-01-02'})
            self.assertEqual(response.data['count'], expected)

    def test_cover_normalized_private_then_public_replace_and_delete(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.data)
        self.activity.refresh_from_db()
        first = self.activity.cover.path
        with Image.open(first) as image:
            self.assertEqual(image.format, 'JPEG')
            self.assertEqual(image.size, (1920, 960))
        self.assertEqual(APIClient().get(self.cover).status_code, 404)
        owned = self.client.get(self.cover)
        self.assertEqual(owned.status_code, 200)
        self.assertTrue(b''.join(owned.streaming_content))
        self.publish()
        public = APIClient().get(self.cover)
        self.assertEqual(public.status_code, 200)
        self.assertIn('no-store', public['Cache-Control'])
        self.assertTrue(b''.join(public.streaming_content))
        replacement = self.upload(self.picture('blue'))
        self.assertNotEqual(response.data['cover_url'], replacement.data['cover_url'])
        self.assertFalse(Path(first).exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(self.cover, **self.headers()).status_code, 200)
        self.assertEqual(APIClient().get(self.cover).status_code, 404)
        self.assertEqual(list(self.media.rglob('*.jpg')), [])

    def test_cover_requires_owner_csrf_and_editable_state(self):
        self.assertEqual(self.client.post(self.cover, {'cover': self.picture()}, format='multipart').status_code, 403)
        self.assertEqual(self.client.delete(self.cover).status_code, 403)
        self.client.force_login(self.other)
        self.assertEqual(self.upload().status_code, 404)
        self.client.force_login(self.volunteer)
        self.assertEqual(self.upload().status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.upload().status_code, 200)
        for status in ['cancelled', 'completed']:
            Activity.objects.filter(pk=self.activity.pk).update(status=status)
            self.assertEqual(self.upload().status_code, 400)
            self.assertEqual(self.client.delete(self.cover, **self.headers()).status_code, 400)
        self.assertEqual(APIClient().get(self.cover).status_code, 404)

    def test_bad_cover_keeps_existing_image_and_database_failure_cleans_new_file(self):
        self.assertEqual(self.upload().status_code, 200)
        self.activity.refresh_from_db()
        old = self.activity.cover.name
        files = [SimpleUploadedFile('fake.png', b'not image'),
                 SimpleUploadedFile('large.png', b'x' * (5 * 1024 * 1024 + 1)),
                 self.picture(fmt='GIF'), self.picture(size=(4001, 4000))]
        for file in files:
            self.assertEqual(self.upload(file).status_code, 400)
        with patch.object(Activity, 'save', side_effect=RuntimeError('Test rollback')):
            self.assertEqual(self.upload().status_code, 500)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.cover.name, old)
        self.assertEqual(len(list(self.media.rglob('*.jpg'))), 1)

    def test_required_skills_do_not_block_volunteer_registration(self):
        self.publish()
        self.activity.required_skills.set(self.skills)
        self.client.force_login(self.volunteer)
        result = self.mutate('post', f'/api/v1/activities/{self.activity.pk}/participation/', {})
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['participation']['status'], 'pending')
