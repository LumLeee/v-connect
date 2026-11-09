from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.recommendations.embeddings import EMBEDDING_DIMENSIONS, EmbeddingUnavailable
from .. import ai, services
from ..models import Feedback
from .test_api import fixtures


def vector(axis=0):
    values = [0.0] * EMBEDDING_DIMENSIONS
    values[axis] = 1.0
    return values


def prototype_vectors(texts, target_axis=0):
    axes = {text: index for index, examples in enumerate(ai.SENTIMENT_PROTOTYPES.values()) for text in examples}
    axes.update({text: index + 3 for index, (_, examples) in enumerate(ai.TOPIC_PROTOTYPES.values()) for text in examples})
    axes.update({text: index + 9 for index, (_, examples) in enumerate(ai.FLAG_PROTOTYPES.values()) for text in examples})
    return [vector(axes.get(text, target_axis)) for text in texts]


def entry(identifier='one', content='Mọi người giúp đỡ nhiệt tình.', rating=5):
    return SimpleNamespace(id=identifier, content=content, rating=rating, created_at=timezone.now(), is_hidden=False)


@override_settings(FEEDBACK_AI_ENABLED=True, MATCHING_AI_MAX_TEXTS=256, MATCHING_AI_MAX_TEXT_CHARS=2000)
class FeedbackAIUnitTests(SimpleTestCase):
    @patch('apps.feedback.ai.embed_texts', side_effect=EmbeddingUnavailable('disabled'))
    def test_shared_engine_switch_is_reported_as_disabled(self, _):
        result = ai.classify_feedback_texts(['Hướng dẫn rõ ràng.'])
        self.assertEqual(result['ai'], ai._metadata('disabled', 'disabled'))

    @patch('apps.feedback.ai.embed_texts')
    def test_invalid_input_falls_back_before_rule_or_model_processing(self, embed):
        for texts in [[None], [''], ['   '], ['Hướng dẫn tốt.', 42], 'not-a-batch', None]:
            with self.subTest(texts=texts):
                result = ai.classify_feedback_texts(texts)
                self.assertEqual(result['ai'], ai._metadata('fallback', 'invalid_input'))
        embed.assert_not_called()

    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_clear_label_uses_cosine_with_fixed_prototypes_and_no_rating_or_identity(self, embed):
        rows = [entry(content='Đây là nội dung được phép.', rating=1)]
        result = ai.analyze_feedback_entries(rows)
        self.assertEqual(result['ai']['status'], 'active')
        self.assertEqual(result['method'], 'local_embedding_prototypes_v1')
        self.assertEqual(next(row['count'] for row in result['sentiments'] if row['key'] == 'positive'), 1)
        self.assertEqual(result['summary']['evidence'], [{'feedback_id': 'one', 'quote': rows[0].content}])
        self.assertEqual(result['summary']['source_feedback_ids'], ['one'])
        self.assertEqual(result['summary']['text'], rows[0].content)
        self.assertTrue(all(isinstance(text, str) for text in embed.call_args.args[0]))
        self.assertNotIn('one', embed.call_args.args[0])

    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_negation_and_mixed_text_abstain_even_with_a_large_model_margin(self, _):
        result = ai.classify_feedback_texts(['Không có sự cố, không ai bị thương.', 'Mọi người tốt nhưng lịch trình rối.'])
        self.assertTrue(all(row['sentiment']['key'] == 'uncertain' for row in result['items']))
        self.assertTrue(all(row['flags'] == [] for row in result['items']))

    @patch('apps.feedback.ai.embed_texts', side_effect=lambda texts: prototype_vectors(texts, target_axis=9))
    def test_incident_flag_is_only_an_advisory_and_negation_suppresses_it(self, _):
        result = ai.classify_feedback_texts(['Tôi bị thương lúc làm việc.', 'Không có ai bị thương.'])
        self.assertEqual(result['items'][0]['flags'][0]['key'], 'safety_review')
        self.assertEqual(result['items'][1]['flags'], [])

    @patch('apps.feedback.ai.embed_texts', side_effect=lambda texts: prototype_vectors(texts, target_axis=10))
    def test_advertising_flag_requires_both_semantic_support_and_literal_cue(self, _):
        result = ai.classify_feedback_texts(['Mua hàng giảm giá tại https://example.invalid', 'Nhóm hỗ trợ bà con.'])
        self.assertEqual(result['items'][0]['flags'][0]['key'], 'spam_review')
        self.assertEqual(result['items'][1]['flags'], [])

    @patch('apps.feedback.ai.embed_texts', return_value=[[float('nan')] * EMBEDDING_DIMENSIONS])
    def test_invalid_or_partial_vectors_fall_back_for_entire_batch(self, _):
        result = ai.analyze_feedback_entries([entry(), entry('two')])
        self.assertEqual(result['ai'], ai._metadata('fallback', 'invalid_output'))
        self.assertEqual(result['topics'], [])
        self.assertEqual(result['summary']['text'], '')
        self.assertEqual(result['summary']['evidence'], [])
        self.assertEqual(result['review_items'][0]['content'], 'Mọi người giúp đỡ nhiệt tình.')
        self.assertEqual(next(row['count'] for row in result['sentiments'] if row['key'] == 'uncertain'), 2)

    @patch('apps.feedback.ai.embed_texts', side_effect=EmbeddingUnavailable('secret-path-or-provider-error'))
    def test_private_error_is_replaced_by_a_fixed_public_reason(self, _):
        result = ai.classify_feedback_texts(['Nội dung'])
        self.assertEqual(result['ai']['reason'], 'inference_failed')
        self.assertNotIn('secret', str(result))

    @override_settings(FEEDBACK_AI_ENABLED=False)
    @patch('apps.feedback.ai.embed_texts')
    def test_feature_disabled_and_empty_scope_do_not_infer(self, embed):
        self.assertEqual(ai.classify_feedback_texts(['Nội dung'])['ai']['status'], 'disabled')
        self.assertEqual(ai.classify_feedback_texts([])['ai']['status'], 'not_applicable')
        embed.assert_not_called()

    @override_settings(FEEDBACK_AI_ENABLED=False)
    @patch('apps.feedback.ai.embed_texts')
    def test_transparent_review_rules_work_when_ai_is_disabled(self, embed):
        result = ai.analyze_feedback_entries([entry(content='Mua ngay hàng giảm giá tại https://example.invalid')])
        self.assertEqual(result['ai']['status'], 'disabled')
        self.assertEqual(result['review_items'][0]['source'], 'rules')
        self.assertEqual(result['review_items'][0]['flags'][0]['source'], 'rules')
        self.assertIn('Quy tắc', result['review_items'][0]['reason'])
        embed.assert_not_called()

    def test_incident_rules_distinguish_occurrence_from_negation_and_training(self):
        for text in ['Không có ai bị thương.', 'Nhóm tập huấn hướng dẫn sơ cứu khi tai nạn xảy ra.',
                     'Thông tin hoạt động tại https://example.invalid']:
            with self.subTest(text=text):
                self.assertEqual(ai.review_rule_flags(text), [])
        self.assertEqual(ai.review_rule_flags('Tôi bị thương khi làm việc.')[0]['key'], 'safety_review')

    @override_settings(MATCHING_AI_MAX_TEXTS=26)
    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_long_input_sampling_stays_within_engine_limits_and_reports_truncation(self, embed):
        result = ai.classify_feedback_texts(['Nội dung hoạt động rất dài. ' * 70])
        self.assertEqual(result['ai']['status'], 'active')
        self.assertTrue(result['truncated'])
        self.assertLessEqual(len(embed.call_args.args[0]), 26)
        self.assertTrue(all(len(text) <= 350 for text in embed.call_args.args[0]))

    @override_settings(MATCHING_AI_MAX_TEXTS=1)
    @patch('apps.feedback.ai.embed_texts')
    def test_insufficient_batch_capacity_does_not_call_model(self, embed):
        result = ai.classify_feedback_texts(['Nội dung'])
        self.assertEqual(result['ai']['reason'], 'batch_too_large')
        embed.assert_not_called()

    def test_source_fingerprint_is_order_independent_and_tracks_content_rating_and_visibility(self):
        one, two = entry(), entry('two')
        before = ai.feedback_source_fingerprint([one, two], {'rating': 'all'})
        self.assertEqual(before, ai.feedback_source_fingerprint([two, one], {'rating': 'all'}))
        self.assertNotEqual(before, ai.feedback_source_fingerprint([one, two], {'rating': '5'}))
        for attribute, value in [('content', 'Thay đổi'), ('rating', 1), ('is_hidden', True)]:
            previous = getattr(one, attribute)
            setattr(one, attribute, value)
            self.assertNotEqual(before, ai.feedback_source_fingerprint([one, two], {'rating': 'all'}))
            setattr(one, attribute, previous)

    @override_settings(FEEDBACK_AI_MAX_ITEMS=1)
    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_row_limit_is_explicit_and_does_not_claim_full_scope_coverage(self, _):
        result = ai.analyze_feedback_entries([entry(), entry('two')])
        self.assertEqual(result['scope']['feedback_count'], 2)
        self.assertEqual(result['scope']['analyzed_count'], 1)
        self.assertTrue(result['scope']['truncated'])
        self.assertEqual(sum(row['count'] for row in result['sentiments']), 1)


@override_settings(FEEDBACK_AI_ENABLED=True, FEEDBACK_AI_MAX_ITEMS=40,
                   MATCHING_AI_MAX_TEXTS=256, MATCHING_AI_MAX_TEXT_CHARS=2000)
class FeedbackAIAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.admin, self.activity, records = fixtures()
        self.first = Feedback.objects.create(attendance=records[0], rating=5, content='Phối hợp thân thiện và ý nghĩa.')
        self.second = Feedback.objects.create(attendance=records[1], rating=1, content='Cần chuẩn bị dụng cụ tốt hơn.')
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/feedback/ai-analysis/'
        self.admin_url = '/api/v1/admin/feedback/ai-analysis/'
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)

    def post(self, url=None, data=None):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url or self.url, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_owner_scope_filter_and_no_mutations(self, embed):
        before = list(Feedback.objects.values())
        response = self.post(data={'rating': '5', 'ordering': 'oldest'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['scope']['feedback_count'], 1)
        self.assertEqual(response.data['scope']['filters'], {'rating': '5', 'ordering': 'oldest'})
        self.assertEqual(response.data['summary']['source_feedback_ids'], [str(self.first.pk)])
        self.assertNotIn(self.second.content, embed.call_args.args[0])
        self.assertEqual(before, list(Feedback.objects.values()))
        self.assertIn('no-store', response['Cache-Control'])
        self.assertNotIn(self.one.email, str(response.data))
        self.assertNotIn(self.one.full_name, str(response.data))

    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_hidden_feedback_and_nonapproved_or_incomplete_activity_are_never_embedded_for_owner(self, embed):
        services.hide(self.first.pk, self.admin, 'Lý do nội bộ')
        response = self.post()
        self.assertEqual(response.data['scope']['feedback_count'], 1)
        self.assertNotIn(self.first.content, str(embed.call_args.args[0]))
        self.assertNotIn('Lý do nội bộ', str(response.data))
        self.activity.status = 'published'
        self.activity.save(update_fields=['status'])
        embed.reset_mock()
        response = self.post()
        self.assertEqual(response.data['scope']['feedback_count'], 0)
        self.assertEqual(response.data['ai']['status'], 'not_applicable')
        embed.assert_not_called()

    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_admin_status_matches_list_visibility(self, embed):
        services.hide(self.first.pk, self.admin, 'Ẩn')
        self.client.force_login(self.admin)
        for status, expected in [('visible', self.second), ('hidden', self.first)]:
            with self.subTest(status=status):
                response = self.post(self.admin_url, {'status': status})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['scope']['feedback_count'], 1)
                self.assertEqual(response.data['summary']['source_feedback_ids'], [str(expected.pk)])
        self.assertEqual(self.post(self.admin_url, {'status': 'all'}).data['scope']['feedback_count'], 2)
        self.assertTrue(embed.called)

    @patch('apps.feedback.ai.embed_texts')
    def test_csrf_role_owner_and_invalid_filters_are_checked_before_inference(self, embed):
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 403)
        for data in [{'rating': '0'}, {'ordering': 'bad'}, {'page': 2}, {'content': 'injected'}, {'status': 'all'}]:
            self.assertEqual(self.post(data=data).status_code, 400)
        self.assertEqual(self.post(self.admin_url).status_code, 403)
        other = User.objects.create_user('other.ai@example.invalid', full_name='Khác', role='organizer')
        self.client.force_login(other)
        self.assertEqual(self.post().status_code, 404)
        for user in [self.one, self.admin]:
            self.client.force_login(user)
            self.assertEqual(self.post().status_code, 403)
        self.client.force_login(self.admin)
        self.assertEqual(self.post(self.admin_url, {'status': 'bad'}).status_code, 400)
        self.assertEqual(self.post(self.admin_url, {'rating': 'all'}).status_code, 400)
        self.client.logout()
        self.assertEqual(self.post().status_code, 401)
        embed.assert_not_called()

    @patch('apps.feedback.ai.embed_texts')
    def test_concurrent_hide_discards_analysis_without_returning_hidden_quote(self, embed):
        def infer(texts):
            services.hide(self.first.pk, self.admin, 'Ẩn khi đang xử lý')
            return prototype_vectors(texts)
        embed.side_effect = infer
        response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'source_changed')
        self.assertNotIn(self.first.content, str(response.data))

    @override_settings(FEEDBACK_AI_MAX_ITEMS=1)
    @patch('apps.feedback.ai.embed_texts', side_effect=prototype_vectors)
    def test_all_filtered_rows_counted_but_only_bounded_snapshot_is_inferred(self, _):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['scope']['feedback_count'], 2)
        self.assertEqual(response.data['scope']['analyzed_count'], 1)
        self.assertTrue(response.data['scope']['truncated'])

    @patch('apps.feedback.ai.embed_texts', side_effect=EmbeddingUnavailable('timeout'))
    def test_model_failure_is_truthful_successful_manual_review_response(self, _):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ai']['status'], 'fallback')
        self.assertEqual(response.data['ai']['reason'], 'timeout')
        self.assertEqual(response.data['summary']['text'], '')
        self.assertEqual(response.data['topics'], [])
        self.assertEqual(len(response.data['review_items']), 2)

    @override_settings(FEEDBACK_AI_ENABLED=False)
    @patch('apps.feedback.ai.embed_texts')
    def test_explicit_analysis_endpoint_is_rate_limited(self, embed):
        for _ in range(12):
            self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.post().status_code, 429)
        embed.assert_not_called()
