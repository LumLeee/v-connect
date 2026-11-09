"""Metric and fixture guards for the independent opt-in diagnostic benchmark."""
import json
from pathlib import Path
import unittest

from evaluate_feedback_ai import evaluate, flag_metrics, sentiment_metrics


class FeedbackEvaluationTests(unittest.TestCase):
    def test_abstentions_stay_in_exact_accuracy_and_coverage(self):
        rows = [
            {'expected_sentiment': 'positive', 'predicted_sentiment': 'positive'},
            {'expected_sentiment': 'negative', 'predicted_sentiment': 'uncertain'},
            {'expected_sentiment': 'uncertain', 'predicted_sentiment': 'uncertain'},
        ]
        result = sentiment_metrics(rows)
        self.assertEqual(result['exact_accuracy_including_uncertain'], 2 / 3)
        self.assertEqual(result['abstentions'], 2)
        self.assertEqual(result['known_label_coverage'], .5)
        self.assertEqual(result['known_label_answered_accuracy'], 1)
        self.assertEqual(result['per_class']['negative']['f1'], 0)
        self.assertIsNone(result['per_class']['neutral']['f1'])

    def test_flags_count_false_positives_and_misses_separately(self):
        result = flag_metrics([
            {'expected_flags': ['incident'], 'predicted_flags': []},
            {'expected_flags': [], 'predicted_flags': ['incident']},
            {'expected_flags': ['spam'], 'predicted_flags': ['spam']},
        ])
        self.assertEqual(result['incident']['false_positive'], 1)
        self.assertEqual(result['incident']['false_negative'], 1)
        self.assertEqual(result['incident']['precision'], 0)
        self.assertEqual(result['spam']['precision'], 1)
        self.assertEqual(result['spam']['recall'], 1)

    def test_provider_receives_only_text_and_preserves_alignment(self):
        data = {'version': 1, 'provenance': 'synthetic', 'limitations': [], 'cases': [
            {'id': 'one', 'content': 'Vui', 'rating': 1, 'expected_sentiment': 'positive', 'expected_flags': []}],
            'diagnostics': [{'id': 'two', 'content': 'Sự cố', 'rating': 5, 'expected_flags': ['incident']}]}
        calls = []
        def classify(texts):
            calls.append(texts)
            return {'ai': {'status': 'active', 'model': 'test'}, 'items': [
                {'sentiment': {'key': 'positive', 'similarity': .6, 'margin': .1}, 'flags': []},
                {'sentiment': {'key': 'negative'}, 'flags': [{'key': 'safety_review', 'source': 'rules', 'ai_supported': True}]}]}
        report = evaluate(data, classify)
        self.assertEqual(calls, [['Vui', 'Sự cố']])
        self.assertEqual(report['sentiment']['exact_accuracy_including_uncertain'], 1)
        self.assertEqual(report['review_flags_diagnostics_only']['incident']['true_positive'], 1)
        self.assertEqual(report['review_flags_by_origin']['rules']['incident']['true_positive'], 1)
        self.assertEqual(report['review_flags_by_origin']['ai']['incident']['true_positive'], 0)
        self.assertEqual(report['diagnostics'][0]['ai_supported_rule_flags'], ['incident'])
        self.assertEqual(report['cases'][0]['similarity'], .6)

    def test_partial_unavailable_or_unknown_results_are_not_quality_scores(self):
        data = {'version': 1, 'provenance': '', 'limitations': [], 'cases': [
            {'id': 'one', 'content': 'text', 'expected_sentiment': 'neutral'}]}
        values = [
            ({'ai': {'status': 'fallback', 'reason': 'timeout'}}, RuntimeError),
            ({'ai': {'status': 'active'}, 'truncated': True}, ValueError),
            ({'ai': {'status': 'active'}, 'items': []}, ValueError),
            ({'ai': {'status': 'active'}, 'items': [{'sentiment': {'key': 'made-up'}}]}, ValueError),
            ({'ai': {'status': 'active'}, 'items': [{'sentiment': {'key': 'neutral'}, 'flags': [{'key': None}]}]}, ValueError),
        ]
        for value, expected in values:
            with self.subTest(value=value), self.assertRaises(expected):
                evaluate(data, lambda texts: value)

    def test_fixture_is_fixed_synthetic_and_covers_negation_without_rating_leak(self):
        root = Path(__file__).resolve().parent.parent
        fixture = json.loads((root / 'document' / 'AI_PHAN_HOI_DANH_GIA.json').read_text(encoding='utf-8'))
        cases = fixture['cases']
        self.assertEqual(len(cases), 20)
        self.assertEqual(len(fixture['diagnostics']), 8)
        self.assertEqual(len({case['id'] for case in cases}), 20)
        self.assertEqual({case['expected_sentiment'] for case in cases}, {'positive', 'neutral', 'negative', 'uncertain'})
        self.assertTrue(any(case['rating'] == 1 and case['expected_sentiment'] == 'positive' for case in cases))
        self.assertTrue(any(case['rating'] == 5 and case['expected_sentiment'] == 'negative' for case in cases))
        self.assertTrue(any('Không có tai nạn' in case['content'] and case['expected_flags'] == [] for case in fixture['diagnostics']))
        for case in [*cases, *fixture['diagnostics']]:
            self.assertNotIn('volunteer_name', case)
            self.assertNotIn('email', case)
        holdout = json.loads((root / 'document' / 'AI_PHAN_HOI_DANH_GIA_V2.json').read_text(encoding='utf-8'))
        self.assertEqual(len(holdout['cases']), 20)
        self.assertEqual(len(holdout['diagnostics']), 8)
        self.assertFalse({case['content'] for case in cases} & {case['content'] for case in holdout['cases']})


if __name__ == '__main__':
    unittest.main()
