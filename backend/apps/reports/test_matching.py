from datetime import datetime, time, timedelta
from types import SimpleNamespace

from django.core.cache import cache
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User, VolunteerProfile
from apps.activities.models import Activity
from apps.core.models import Skill
from apps.participations.models import Participation
from .matching import ZONE, availability_ratio, evaluate


class AvailabilityTests(SimpleTestCase):
    def test_weekly_coverage_boundaries_partial_and_multiple_weeks(self):
        monday = datetime(2026, 10, 12, 8, tzinfo=ZONE)
        slots = [SimpleNamespace(weekday=0, starts_at=time(8), ends_at=time(10)),
                 SimpleNamespace(weekday=0, starts_at=time(10), ends_at=time(12))]
        for start, end, expected in [
            (monday, monday + timedelta(hours=4), 1),
            (monday, monday + timedelta(hours=8), .5),
            (monday + timedelta(hours=4), monday + timedelta(hours=5), 0),
            (monday - timedelta(hours=12), monday + timedelta(hours=12), 4 / 24),
            (monday, monday + timedelta(weeks=2), 8 / 336),
        ]:
            with self.subTest(start=start, end=end):
                self.assertAlmostEqual(availability_ratio(SimpleNamespace(starts_at=start, ends_at=end), slots), expected)
        self.assertIsNone(availability_ratio(SimpleNamespace(starts_at=monday, ends_at=monday), []))


class MatchingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('match.org@example.invalid', role='organizer', full_name='Tổ chức')
        self.user = User.objects.create_user('match.vol@example.invalid', full_name='Người phù hợp')
        self.profile = VolunteerProfile.objects.create(user=self.user, interests=['Môi trường'])
        self.skill = Skill.objects.create(name='Trồng cây', slug='matching-tree')
        self.profile.skills.add(self.skill)
        self.activity = self.make_activity()
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/matching/'

    def make_activity(self, **changes):
        now = timezone.now()
        values = dict(organizer=self.owner, title='Bảo vệ MÔI TRƯỜNG', description='Trồng cây', address='Huế',
                      capacity=3, starts_at=now + timedelta(days=2), ends_at=now + timedelta(days=2, hours=4),
                      status='published', published_at=now)
        values.update(changes)
        activity = Activity.objects.create(**values)
        activity.required_skills.add(self.skill)
        return activity

    def entry(self, activity, status='approved', volunteer=None):
        return Participation.objects.create(activity=activity, volunteer=volunteer or self.user, status=status,
            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)

    def test_score_missing_data_and_phrase_boundaries(self):
        result = evaluate(self.activity, self.profile)
        self.assertEqual(result['score'], 70)
        self.assertIsNone(result['availability_percent'])
        self.profile.interests = ['moi truong', 'cây xanh', 'trườ']
        self.assertEqual(evaluate(self.activity, self.profile)['matched_interests'], ['moi truong'])
        self.assertEqual(evaluate(self.activity, None)['score'], 0)
        self.activity.required_skills.clear()
        self.assertEqual(evaluate(self.activity, self.profile)['score'], 20)

    def test_consent_privacy_revocation_and_no_automatic_registration(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.profile.matching_visible = True
        self.profile.save()
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 1)
        self.assertIn('no-store', response['Cache-Control'])
        row = response.data['results'][0]
        self.assertEqual(set(row['volunteer']), {'id', 'full_name'})
        for private in ['email', 'phone', 'availability', 'interests', 'skills']:
            self.assertNotIn(private, row)
        self.assertFalse(Participation.objects.exists())
        self.profile.matching_visible = False
        self.profile.save()
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/v1/matching/activities/').data['count'], 1)

    def test_activity_eligibility_and_registration_states(self):
        self.client.force_login(self.user)
        for status in ['draft', 'completed', 'cancelled']:
            self.make_activity(status=status)
        self.make_activity(published_at=None)
        self.make_activity(starts_at=timezone.now() - timedelta(hours=1))
        full = self.make_activity(capacity=1)
        other = User.objects.create_user('match.other@example.invalid', full_name='Khác')
        self.entry(full, volunteer=other)
        for status in ['pending', 'approved', 'rejected', 'cancelled']:
            entry = self.entry(self.activity, status)
            response = self.client.get('/api/v1/matching/activities/')
            self.assertEqual(response.data['count'], 1 if status == 'cancelled' else 0)
            entry.delete()

    def test_conflicts_exclude_both_directions_but_adjacent_allowed(self):
        self.profile.matching_visible = True
        self.profile.save()
        busy = self.make_activity()
        entry = self.entry(busy)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/v1/matching/activities/').data['count'], 0)
        busy.starts_at = self.activity.ends_at
        busy.ends_at = busy.starts_at + timedelta(hours=1)
        busy.save()
        self.assertEqual(self.client.get('/api/v1/matching/activities/').data['count'], 1)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.url).data['count'], 1)
        entry.status = 'cancelled'
        entry.save()

    def test_permissions_owner_scope_and_pagination(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.make_activity()
        response = self.client.get('/api/v1/matching/activities/?page_size=1')
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get('/api/v1/matching/activities/').status_code, 403)
        other = User.objects.create_user('match.stranger@example.invalid', role='organizer', full_name='Khác')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_candidate_inactive_registered_and_activity_closed(self):
        self.profile.matching_visible = True
        self.profile.save()
        self.client.force_login(self.owner)
        for status in ['pending', 'approved', 'rejected', 'cancelled']:
            entry = self.entry(self.activity, status)
            self.assertEqual(self.client.get(self.url).data['count'], 1 if status == 'cancelled' else 0)
            entry.delete()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.user.is_active = True
        self.user.save()
        self.activity.status = 'completed'
        self.activity.save()
        self.assertEqual(self.client.get(self.url).data['count'], 0)
