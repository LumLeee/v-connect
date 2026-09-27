from unittest.mock import patch

from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient, APITestCase

from apps.core.models import Skill
from .models import AvailabilitySlot, User, VolunteerProfile


class ExtendedProfileTests(APITestCase):
    url = '/api/v1/auth/profile/'

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('extended@example.invalid', full_name='An')
        self.other = User.objects.create_user('other.extended@example.invalid', full_name='Bình')
        self.skill = Skill.objects.create(name='Trồng cây', slug='extended-plant')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)

    def update(self, fields, **basic):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.patch(self.url, {'volunteer': fields, **basic}, format='json', HTTP_X_CSRFTOKEN=token)

    def slot(self, day=0, start='08:00', end='12:00'):
        return {'weekday': day, 'starts_at': start, 'ends_at': end}

    def test_round_trip_partial_update_clear_and_private_scope(self):
        response = self.update({'skills': [self.skill.pk], 'interests': ['  Môi trường  '],
                                'availability': [self.slot(6), self.slot(0)]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['profile']['volunteer'], {
            'skills': [self.skill.pk], 'interests': ['Môi trường'], 'availability': [self.slot(0), self.slot(6)]})
        self.assertEqual(self.update({'interests': ['Giáo dục']}).status_code, 200)
        profile = self.client.get(self.url).data['profile']['volunteer']
        self.assertEqual(profile['skills'], [self.skill.pk])
        self.assertEqual(len(profile['availability']), 2)
        self.assertFalse(VolunteerProfile.objects.filter(user=self.other).exists())
        self.client.force_login(self.other)
        response = self.client.get(self.url + f'?user_id={self.user.pk}')
        self.assertEqual(response.data['profile']['id'], str(self.other.pk))
        self.assertFalse(response.data['profile'].get('volunteer'))
        self.client.force_login(self.user)
        response = self.update({'skills': [], 'interests': [], 'availability': []})
        self.assertEqual(response.data['profile']['volunteer'], {'skills': [], 'interests': [], 'availability': []})

    def test_skills_interests_and_unknown_fields_validation_is_atomic(self):
        bad_values = [
            {'skills': [self.skill.pk, self.skill.pk]}, {'skills': [999999]},
            {'interests': ['Trồng cây', 'trồng cây']}, {'interests': [' ']},
            {'interests': ['a' * 81]}, {'interests': [str(i) for i in range(21)]},
            {'user': str(self.other.pk)}, {'availability': [dict(self.slot(), profile=1)]},
        ]
        for fields in bad_values:
            with self.subTest(fields=fields):
                self.assertEqual(self.update(fields, full_name='Không lưu').status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'An')
        self.assertFalse(VolunteerProfile.objects.exists())

    def test_availability_rejects_missing_invalid_overlap_and_overnight(self):
        bad_values = [
            [self.slot(7)], [self.slot(-1)], [{'weekday': 0}],
            [self.slot(start='12:00', end='12:00')], [self.slot(start='22:00', end='02:00')],
            [self.slot(start='08:00:30')], [self.slot(start='24:00')],
            [self.slot(), self.slot()], [self.slot(), self.slot(start='11:59', end='13:00')],
            [self.slot(), self.slot(start='09:00', end='10:00')], [self.slot()] * 29,
        ]
        for slots in bad_values:
            with self.subTest(slots=slots):
                self.assertEqual(self.update({'availability': slots}).status_code, 400)
        self.assertEqual(self.update({'availability': [self.slot(), self.slot(start='12:00', end='13:00'), self.slot(1)]}).status_code, 200)

    def test_role_csrf_and_authentication(self):
        self.assertEqual(self.client.patch(self.url, {'volunteer': {}}, format='json').status_code, 403)
        for role in ['organizer', 'admin']:
            user = User.objects.create_user(f'{role}.extended@example.invalid', role=role,
                full_name=role, **({'username': 'extended.admin'} if role == 'admin' else {}))
            self.client.force_login(user)
            self.assertEqual(self.update({'interests': ['Cộng đồng']}).status_code, 400)
        self.assertFalse(VolunteerProfile.objects.exists())
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_write_failure_rolls_back_basic_profile_and_all_relations(self):
        self.update({'skills': [self.skill.pk], 'interests': ['Cũ'], 'availability': [self.slot()]})
        with patch('apps.accounts.profile_serializers.AvailabilitySlot.objects.bulk_create', side_effect=IntegrityError('test rollback')):
            response = self.update({'skills': [], 'interests': ['Mới'], 'availability': [self.slot(1)]}, full_name='Không lưu')
            self.assertEqual(response.status_code, 500)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'An')
        profile = self.user.volunteer_profile
        self.assertEqual(profile.interests, ['Cũ'])
        self.assertEqual(profile.skills.count(), 1)
        self.assertEqual(profile.availability.get().weekday, 0)

    def test_database_constraints_guard_invalid_slots(self):
        profile = VolunteerProfile.objects.create(user=self.user)
        for slot in [self.slot(7), self.slot(start='12:00', end='08:00')]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                AvailabilitySlot.objects.create(profile=profile, **slot)
        AvailabilitySlot.objects.create(profile=profile, **self.slot())
        with self.assertRaises(IntegrityError), transaction.atomic():
            AvailabilitySlot.objects.create(profile=profile, **self.slot())
