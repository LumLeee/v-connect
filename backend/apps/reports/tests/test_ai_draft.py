from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.feedback.models import Feedback
from apps.feedback.services import hide, submit
from apps.feedback.tests.test_api import fixtures
from apps.participations.models import Contribution
from apps.recommendations.embeddings import EmbeddingUnavailable
from ..ai_draft import _chunks, select_evidence


def vector(index=0):
    return [1. if item == index else 0. for item in range(384)]


@override_settings(MATCHING_AI_MAX_TEXTS=256)
class ExtractiveSummaryTests(SimpleTestCase):
    def test_chunks_are_short_verbatim_spans_and_truncation_is_explicit(self):
        text = ('Hướng dẫn rất dễ hiểu. Cần thêm dụng cụ và nước uống. ' * 40).strip()
        chunks, truncated = _chunks(text)
        self.assertEqual(len(chunks), 3)
        self.assertTrue(truncated)
        self.assertTrue(all(chunk in text and len(chunk) <= 240 for chunk in chunks))

    def test_evidence_is_verbatim_diverse_and_includes_contrasting_star_buckets(self):
        rows = [{'id': str(index), 'rating': rating, 'content': text} for index, (rating, text) in enumerate([
            (5, 'Hướng dẫn rõ ràng và tận tình.'), (5, 'Hướng dẫn rõ ràng và tận tình.'),
            (1, 'Thiếu nước uống, cần cải thiện.'), (3, 'Buổi hoạt động diễn ra đúng lịch.'),
        ])]
        with patch('apps.reports.ai_draft.embed_texts', side_effect=lambda texts: [vector() for _ in texts]):
            evidence, _ = select_evidence(rows)
        self.assertEqual(len({item['quote'] for item in evidence}), len(evidence))
        self.assertEqual(len({item['feedback_id'] for item in evidence}), len(evidence))
        self.assertIn(1, [item['rating'] for item in evidence])
        self.assertIn(5, [item['rating'] for item in evidence])
        for item in evidence:
            self.assertIn(item['quote'], rows[int(item['feedback_id'])]['content'])

    def test_invalid_vectors_or_excessive_inputs_are_rejected_as_whole_batch(self):
        rows = [{'id': 'one', 'rating': 5, 'content': 'Hướng dẫn rõ ràng.'}]
        for batch in [[], [[float('nan')] * 384], [[0] * 384], [[1, 2]]]:
            with self.subTest(batch=len(batch)), patch('apps.reports.ai_draft.embed_texts', return_value=batch):
                with self.assertRaises(EmbeddingUnavailable):
                    select_evidence(rows)
        with override_settings(MATCHING_AI_MAX_TEXTS=0), patch('apps.reports.ai_draft.embed_texts') as provider:
            with self.assertRaises(EmbeddingUnavailable):
                select_evidence(rows)
            provider.assert_not_called()


@override_settings(REPORT_AI_ENABLED=True, REPORT_AI_MAX_FEEDBACK=40, ACTIVITY_TIME_CHECKS_ENABLED=True)
class AIDraftAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, self.attendances = fixtures()
        self.feedback = submit(self.activity.pk, self.one, {'rating': 5, 'content': 'Các bạn hướng dẫn rõ ràng và tận tình.'})
        Contribution.objects.create(attendance=self.attendances[0], score=8, confirmed_by=self.owner)
        self.url = f'/api/v1/reports/activities/{self.activity.pk}/ai-draft/'
        self.summary_url = f'/api/v1/reports/activities/{self.activity.pk}/summary-document/'
        self.client.force_login(self.owner)
        self.provider = patch('apps.reports.ai_draft.embed_texts', side_effect=lambda texts: [vector() for _ in texts])
        self.model = self.provider.start()
        self.addCleanup(self.provider.stop)

    def post(self, data=None):
        return self.client.post(self.url, {} if data is None else data, format='json')

    def test_actual_snapshot_numbers_and_source_quotes_not_invented_or_saved(self):
        before = list(Feedback.objects.values())
        response = self.post()
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['ai']['status'], 'active')
        self.assertEqual(data['method'], 'local_extractive_report_v1')
        self.assertEqual(data['source']['contributions'], {'score': 8, 'confirmed': 1, 'pending': 1})
        self.assertEqual(data['source']['metrics']['registered'], 2)
        self.assertEqual(data['source']['feedback_count'], 1)
        self.assertEqual(data['evidence'], [{'feedback_id': str(self.feedback.pk), 'quote': self.feedback.content, 'rating': 5}])
        sections = {section['key']: section for section in data['draft']['sections']}
        self.assertIn('2 đơn đăng ký', sections['participation']['text'])
        self.assertIn('là 8', sections['contributions']['text'])
        self.assertEqual(sections['feedback']['source_refs'], [str(self.feedback.pk)])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(list(Feedback.objects.values()), before)
        self.assertEqual(Contribution.objects.count(), 1)
        self.assertEqual(self.model.call_args.args[0], [self.feedback.content])
        self.assertNotIn(self.one.email, ' '.join(self.model.call_args.args[0]))

    def test_permissions_precede_inference_and_read_method_not_supported(self):
        other = User.objects.create_user('draft.other@example.invalid', role='organizer', full_name='Khác')
        for user, code in [(other, 404), (self.one, 403)]:
            self.client.force_login(user)
            self.assertEqual(self.post().status_code, code)
        self.client.logout()
        self.assertEqual(self.post().status_code, 401)
        self.model.assert_not_called()
        self.client.force_login(self.admin)
        self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.client.get(self.url).status_code, 405)

    def test_completed_and_ended_are_required_before_model(self):
        for status in ['draft', 'published', 'cancelled']:
            self.activity.status = status
            self.activity.save(update_fields=['status'])
            self.assertEqual(self.post().status_code, 400)
        self.activity.status = 'completed'
        self.activity.ends_at = timezone.now() + timedelta(days=1)
        self.activity.save()
        self.assertEqual(self.post().status_code, 400)
        self.model.assert_not_called()

    def test_hidden_feedback_never_enters_model_or_draft(self):
        hidden = submit(self.activity.pk, self.two, {'rating': 1, 'content': 'PRIVATE_HIDDEN_CONTENT'})
        hide(hidden.pk, self.admin, 'Rà soát')
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source']['feedback_count'], 1)
        self.assertNotIn('PRIVATE_HIDDEN_CONTENT', str(response.data))
        self.assertNotIn('PRIVATE_HIDDEN_CONTENT', ' '.join(self.model.call_args.args[0]))

    def test_fallback_preserves_real_facts_without_fake_ai_excerpts(self):
        for error in [EmbeddingUnavailable('model_missing'), EmbeddingUnavailable('timeout'),
                      RuntimeError('PRIVATE_PATH'), EmbeddingUnavailable('PRIVATE_REASON')]:
            with self.subTest(error=str(error)):
                self.model.side_effect = error
                data = self.post().data
                self.assertEqual(data['ai']['status'], 'fallback')
                self.assertIsNone(data['ai']['model'])
                self.assertEqual(data['evidence'], [])
                self.assertEqual(data['method'], 'facts_template_v1')
                self.assertEqual(data['source']['metrics']['registered'], 2)
                self.assertNotIn('PRIVATE_', str(data))

    def test_empty_feedback_or_disabled_ai_uses_factual_template_without_model(self):
        with override_settings(REPORT_AI_ENABLED=False):
            self.assertEqual(self.post().data['ai']['status'], 'disabled')
        hide(self.feedback.pk, self.admin, 'Rà soát')
        self.assertEqual(self.post().data['ai']['status'], 'not_applicable')
        self.model.assert_not_called()

    def test_stale_expected_snapshot_rejected_then_fresh_snapshot_works(self):
        old = self.client.get(self.summary_url).data['source_fingerprint']
        Contribution.objects.create(attendance=self.attendances[1], score=3, confirmed_by=self.owner)
        self.assertEqual(self.post({'expected_source_fingerprint': old}).status_code, 409)
        self.model.assert_not_called()
        new = self.client.get(self.summary_url).data['source_fingerprint']
        self.assertNotEqual(old, new)
        self.assertEqual(self.post({'expected_source_fingerprint': new}).status_code, 200)

    def test_hidden_during_inference_discards_old_scope_instead_of_returning_quote(self):
        def inference(texts):
            hide(self.feedback.pk, self.admin, 'Rà soát đồng thời')
            return [vector() for _ in texts]
        self.model.side_effect = inference
        response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertNotIn(self.feedback.content, str(response.data))

    def test_bounded_scope_reports_sampling_and_truncation(self):
        self.feedback.content = 'Nội dung phản hồi dài và cần được rà soát. ' * 30
        self.feedback.save(update_fields=['content'])
        submit(self.activity.pk, self.two, {'rating': 2, 'content': 'Cần thêm dụng cụ.'})
        with override_settings(REPORT_AI_MAX_FEEDBACK=1):
            data = self.post().data
        self.assertEqual(data['source']['feedback_count'], 2)
        self.assertEqual(data['source']['analyzed_count'], 1)
        self.assertTrue(data['source']['truncated'])

    def test_no_arbitrary_prompts_or_unvalidated_facts_and_csrf_enforced(self):
        self.assertEqual(self.post({'prompt': 'Invent beneficiaries', 'registered': 999}).status_code, 400)
        self.assertEqual(self.post({'expected_source_fingerprint': 'bad'}).status_code, 400)
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.owner)
        self.assertEqual(client.post(self.url, {}, format='json').status_code, 403)
        self.model.assert_not_called()
