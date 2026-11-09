"""AI ranking contract tests. Inference is mocked; real quality is opt-in script."""
from datetime import datetime, time, timedelta
import json
import math
from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User, VolunteerProfile
from apps.activities.models import Activity
from apps.participations.models import Participation
from apps.recommendations.embeddings import EmbeddingUnavailable
from ..matching import ZONE, activity_text, evaluate, profile_text, rank_matches


def vector(similarity=1):
    return [similarity, math.sqrt(max(0, 1 - similarity ** 2)), *([0.] * 382)]


def related(items):
    return SimpleNamespace(all=lambda: items)


def fake_pair(full_rules=False):
    skill = SimpleNamespace(pk=1, name='Nấu ăn')
    start = datetime(2026, 11, 9, 8, tzinfo=ZONE)
    activity = SimpleNamespace(title='Nấu ăn cộng đồng', description='Chuẩn bị bữa trưa cho bà con.',
                               required_skills=related([skill] if full_rules else []),
                               starts_at=start, ends_at=start + timedelta(hours=4),
                               address='PRIVATE_ADDRESS_NOT_INPUT')
    profile = SimpleNamespace(skills=related([skill] if full_rules else []),
                              interests=['Nấu ăn' if full_rules else 'giúp người khó khăn có bữa cơm'],
                              availability=related([SimpleNamespace(weekday=0, starts_at=time(8), ends_at=time(12))]
                                                   if full_rules else []),
                              user=SimpleNamespace(full_name='PRIVATE_NAME_NOT_INPUT', email='private@example.invalid',
                                                   phone='PRIVATE_PHONE_NOT_INPUT', bio='PRIVATE_BIO_NOT_INPUT'))
    return activity, profile


@override_settings(MATCHING_AI_ENABLED=True, MATCHING_AI_MIN_SIMILARITY=.35,
                   MATCHING_AI_MAX_TEXTS=256, MATCHING_AI_MAX_TEXT_CHARS=2000)
class HybridRankingTests(SimpleTestCase):
    def test_hybrid_weights_remain_bounded_and_do_not_relabel_inferred_skills(self):
        activity, profile = fake_pair(full_rules=True)
        with patch('apps.reports.matching.embed_texts', side_effect=lambda texts: [vector() for _ in texts]):
            matches, meta = rank_matches([(activity, profile)])
        self.assertEqual(matches[0]['rule_score'], 100)
        self.assertEqual(matches[0]['score'], 100)
        self.assertEqual(matches[0]['components'], {'skills': 35, 'interests': 14, 'availability': 21, 'semantic': 30})
        self.assertEqual(meta['component_limits'], {'skills': 35, 'interests': 14, 'availability': 21, 'semantic': 30})
        self.assertEqual(meta['ai']['status'], 'active')
        self.assertEqual(meta['method'], 'hybrid_embeddings_v1')
        activity, profile = fake_pair()
        with patch('apps.reports.matching.embed_texts', side_effect=lambda texts: [vector() for _ in texts]):
            matches, _ = rank_matches([(activity, profile)])
        self.assertEqual(matches[0]['rule_score'], 0)
        self.assertEqual(matches[0]['score'], 30)
        self.assertEqual(matches[0]['matched_skills'], [])
        self.assertEqual(matches[0]['matched_interests'], [])

    def test_semantic_cutoff_negative_and_partial_similarity(self):
        for similarity, expected in [(-1, 0), (0, 0), (.35, 0), (.675, 15), (1, 30)]:
            with self.subTest(similarity=similarity):
                with patch('apps.reports.matching.embed_texts', return_value=[vector(), vector(similarity)]):
                    matches, meta = rank_matches([fake_pair()])
                self.assertEqual(matches[0]['components']['semantic'], expected)
                self.assertEqual(matches[0]['semantic']['cosine'], similarity)
                self.assertEqual(meta['ai']['status'], 'active')

    def test_disabled_empty_and_blank_profiles_never_invoke_model(self):
        activity, profile = fake_pair()
        with patch('apps.reports.matching.embed_texts') as inference:
            with override_settings(MATCHING_AI_ENABLED=False):
                matches, meta = rank_matches([(activity, profile)])
                self.assertEqual(matches, [evaluate(activity, profile)])
                self.assertEqual(meta['ai']['status'], 'disabled')
            matches, meta = rank_matches([])
            self.assertEqual(matches, [])
            self.assertEqual(meta['ai']['status'], 'not_applicable')
            profile.interests = []
            matches, meta = rank_matches([(activity, profile), (activity, None)])
            self.assertEqual([row['score'] for row in matches], [0, 0])
            self.assertEqual(meta['ai']['status'], 'not_applicable')
            inference.assert_not_called()

    def test_missing_profile_among_other_candidates_cannot_gain_semantic_points(self):
        activity, profile = fake_pair()
        with patch('apps.reports.matching.embed_texts', side_effect=lambda texts: [vector() for _ in texts]):
            matches, meta = rank_matches([(activity, None), (activity, profile)])
        self.assertEqual([row['score'] for row in matches], [0, 30])
        self.assertIsNone(matches[0]['semantic'])
        self.assertEqual(meta['ai']['status'], 'active')

    def test_all_candidates_revert_to_original_formula_on_provider_failure(self):
        pairs = [fake_pair(), fake_pair(full_rules=True)]
        for problem, reason in [(EmbeddingUnavailable('model_missing'), 'model_missing'),
                                (RuntimeError('PRIVATE_LOCAL_PATH_OR_INPUT'), 'inference_failed')]:
            with self.subTest(reason=reason), patch('apps.reports.matching.embed_texts', side_effect=problem):
                matches, meta = rank_matches(pairs)
                self.assertEqual(matches, [evaluate(*pair) for pair in pairs])
                self.assertEqual(meta['component_limits'], {'skills': 50, 'interests': 20, 'availability': 30})
                self.assertEqual(meta['ai']['status'], 'fallback')
                self.assertEqual(meta['ai']['reason'], reason)
                self.assertNotIn('PRIVATE_', json.dumps(meta))

    def test_invalid_vectors_restore_whole_response_without_nan(self):
        invalid_batches = [[], [vector()], [[0.] * 384, vector()],
                           [[float('nan')] * 384, vector()], [[float('inf')] * 384, vector()],
                           [[1, 0], [1, 0]], [['bad'] * 384, vector()]]
        pair = fake_pair(full_rules=True)
        for batch in invalid_batches:
            with self.subTest(batch_type=type(batch[0]).__name__ if batch else 'empty'):
                with patch('apps.reports.matching.embed_texts', return_value=batch):
                    matches, meta = rank_matches([pair])
                self.assertEqual(matches, [evaluate(*pair)])
                self.assertEqual(meta['ai']['status'], 'fallback')
                self.assertEqual(meta['ai']['reason'], 'invalid_vectors')
                self.assertIsNone(meta['ai']['model'])
                json.dumps({'matches': matches, 'metadata': meta}, allow_nan=False)

    def test_input_limit_and_bad_threshold_use_original_rules_without_inference(self):
        pair = fake_pair(full_rules=True)
        for changes, reason in [({'MATCHING_AI_MAX_TEXTS': 1}, 'input_limit'),
                                ({'MATCHING_AI_MIN_SIMILARITY': float('nan')}, 'invalid_configuration'),
                                ({'MATCHING_AI_MIN_SIMILARITY': 1}, 'invalid_configuration')]:
            with self.subTest(changes=changes), override_settings(**changes):
                with patch('apps.reports.matching.embed_texts') as inference:
                    matches, meta = rank_matches([pair])
                inference.assert_not_called()
                self.assertEqual(matches, [evaluate(*pair)])
                self.assertEqual(meta['ai']['reason'], reason)

    def test_batch_deduplicates_matching_text_and_excludes_private_fields(self):
        pair = fake_pair(full_rules=True)
        with patch('apps.reports.matching.embed_texts', side_effect=lambda texts: [vector() for _ in texts]) as inference:
            matches, _ = rank_matches([pair, pair])
        self.assertEqual(len(matches), 2)
        inference.assert_called_once()
        sent = inference.call_args.args[0]
        self.assertEqual(sent, [profile_text(pair[1]), activity_text(pair[0])])
        self.assertNotIn('PRIVATE_', ' '.join(sent))
        self.assertNotIn('private@example.invalid', ' '.join(sent))
        with override_settings(MATCHING_AI_MAX_TEXT_CHARS=10):
            self.assertLessEqual(len(profile_text(pair[1])), 10)
            self.assertLessEqual(len(activity_text(pair[0])), 10)


@override_settings(MATCHING_AI_ENABLED=True, ACTIVITY_TIME_CHECKS_ENABLED=True,
                   MATCHING_AI_MIN_SIMILARITY=.35, MATCHING_AI_MAX_TEXTS=256)
class MatchingAIAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('ai.org@example.invalid', role='organizer', full_name='PRIVATE_ORG_NAME')
        self.volunteer = User.objects.create_user('ai.vol@example.invalid', full_name='PRIVATE_VOLUNTEER_NAME',
                                                 phone='0123456789', bio='PRIVATE_BIO')
        self.profile = VolunteerProfile.objects.create(user=self.volunteer,
                                                       interests=['giúp ông bà làm quen với thiết bị số'],
                                                       matching_visible=True)
        self.activity = self.make_activity()
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/matching/'
        self.activities_url = '/api/v1/matching/activities/'
        self.inference = patch('apps.reports.matching.embed_texts', side_effect=lambda texts: [vector() for _ in texts])
        self.model = self.inference.start()
        self.addCleanup(self.inference.stop)

    def make_activity(self, **changes):
        now = timezone.now()
        values = dict(organizer=self.owner, title='Kết nối số',
                      description='Chỉ dẫn các bác dùng điện thoại thông minh và gọi video.',
                      address='PRIVATE_ACTIVITY_ADDRESS', capacity=3, starts_at=now + timedelta(days=2),
                      ends_at=now + timedelta(days=2, hours=3), status='published', published_at=now)
        values.update(changes)
        return Activity.objects.create(**values)

    def entry(self, activity, volunteer=None):
        return Participation.objects.create(activity=activity, volunteer=volunteer or self.volunteer, status='approved',
                                            registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at,
                                            registered_address=activity.address)

    def test_semantic_only_suggestions_work_both_directions_without_registering(self):
        self.client.force_login(self.volunteer)
        response = self.client.get(self.activities_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        row = response.data['results'][0]
        self.assertEqual((row['rule_score'], row['score']), (0, 30))
        self.assertEqual(row['matched_skills'], [])
        self.assertEqual(row['matched_interests'], [])
        self.assertEqual(response.data['method'], 'hybrid_embeddings_v1')
        self.assertIn('no-store', response['Cache-Control'])
        self.client.force_login(self.owner)
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 1)
        row = response.data['results'][0]
        self.assertEqual(row['volunteer'], {'id': str(self.volunteer.pk), 'full_name': self.volunteer.full_name})
        self.assertFalse(Participation.objects.exists())
        for key in ['email', 'phone', 'bio', 'skills', 'interests', 'availability', 'vectors', 'embedding', 'profile_text']:
            self.assertNotIn(key, row)
        sent = ' '.join(self.model.call_args.args[0])
        for private in ['PRIVATE_', 'ai.vol@example.invalid', '0123456789']:
            self.assertNotIn(private, sent)

    def test_consent_revocation_inactive_account_and_wrong_owner_precede_model(self):
        self.client.force_login(self.owner)
        for changes in [{'matching_visible': False}, {'matching_visible': True}]:
            self.profile.matching_visible = changes['matching_visible']
            self.profile.save()
            if changes['matching_visible']:
                self.volunteer.is_active = False
                self.volunteer.save()
            response = self.client.get(self.url)
            self.assertEqual(response.data['count'], 0)
        self.model.assert_not_called()
        self.volunteer.is_active = True
        self.volunteer.save()
        self.client.force_login(self.volunteer)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        other = User.objects.create_user('ai.other.org@example.invalid', role='organizer', full_name='Other')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.model.assert_not_called()

    def test_ineligible_activities_and_schedule_conflict_are_not_sent_to_model(self):
        self.client.force_login(self.volunteer)
        self.make_activity(title='PRIVATE_DRAFT', status='draft')
        self.make_activity(title='PRIVATE_COMPLETED', status='completed')
        self.make_activity(title='PRIVATE_UNPUBLISHED', published_at=None)
        self.make_activity(title='PRIVATE_STARTED', starts_at=timezone.now() - timedelta(hours=1))
        full = self.make_activity(title='PRIVATE_FULL', capacity=1)
        other = User.objects.create_user('ai.other.vol@example.invalid', full_name='Other')
        self.entry(full, volunteer=other)
        self.assertEqual(self.client.get(self.activities_url).data['count'], 1)
        sent = ' '.join(self.model.call_args.args[0])
        self.assertNotIn('PRIVATE_', sent)
        self.model.reset_mock()
        busy = self.make_activity(title='Already approved')
        self.entry(busy)
        self.assertEqual(self.client.get(self.activities_url).data['count'], 0)
        self.model.assert_not_called()
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.url).data['count'], 0)
        self.model.assert_not_called()

    def test_ranking_runs_before_pagination_and_zero_similarity_is_excluded(self):
        self.client.force_login(self.volunteer)
        better = self.make_activity(title='HIGH_SEMANTIC')
        irrelevant = self.make_activity(title='ZERO_SEMANTIC')
        def vectors(texts):
            output = []
            for text in texts:
                output.append(vector(.1) if 'ZERO_SEMANTIC' in text else
                              vector(.675) if 'Kết nối số' in text else vector())
            return output
        self.model.side_effect = vectors
        response = self.client.get(self.activities_url + '?page_size=1')
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['results'][0]['activity']['id'], str(better.pk))
        self.assertIsNotNone(response.data['next'])
        self.assertEqual(len(self.model.call_args.args[0]), 4)
        response = self.client.get(self.activities_url + '?page_size=1&page=2')
        self.assertEqual(response.data['results'][0]['activity']['id'], str(self.activity.pk))
        self.assertNotEqual(response.data['results'][0]['activity']['id'], str(irrelevant.pk))

    def test_inference_failure_preserves_legacy_scores_and_does_not_expose_error(self):
        self.profile.interests = ['điện thoại']
        self.profile.save()
        self.make_activity(title='Hoạt động thứ hai')
        self.model.side_effect = RuntimeError('PRIVATE_PATH PRIVATE_PROFILE_CONTENT')
        self.client.force_login(self.volunteer)
        response = self.client.get(self.activities_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['method'], 'rules_v1')
        self.assertEqual(response.data['ai']['status'], 'fallback')
        self.assertEqual(response.data['ai']['reason'], 'inference_failed')
        self.assertEqual([row['score'] for row in response.data['results']], [20, 20])
        self.assertNotIn('PRIVATE_PATH', json.dumps(response.data))

    def test_blank_profile_never_gets_semantic_only_recommendations(self):
        self.profile.interests = []
        self.profile.save()
        self.client.force_login(self.volunteer)
        response = self.client.get(self.activities_url)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['ai']['status'], 'not_applicable')
        self.model.assert_not_called()
