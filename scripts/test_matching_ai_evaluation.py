"""Arithmetic and fixture guards for the opt-in real-model benchmark, no model/DB."""
import json
from pathlib import Path
import unittest

from evaluate_matching_ai import activity_text, cosine, evaluate, pairwise_summary, profile_text, rule_score


class MatchingEvaluationTests(unittest.TestCase):
    def test_cosine_is_scale_independent_and_keeps_negative_relationship(self):
        self.assertAlmostEqual(cosine([3, 4], [6, 8]), 1)
        self.assertAlmostEqual(cosine([3, 4], [-6, -8]), -1)
        self.assertAlmostEqual(cosine([1, 0], [0, 1]), 0)

    def test_invalid_or_zero_embeddings_are_rejected(self):
        for left, right in [([], []), ([0, 0], [1, 0]), ([1], [1, 0]),
                            ([float('nan')], [1]), ([1], [float('inf')])]:
            with self.subTest(left=left, right=right), self.assertRaises(ValueError):
                cosine(left, right)

    def test_ties_are_reported_separately_from_strict_accuracy(self):
        result = pairwise_summary([{'gap': 1}, {'gap': 0}, {'gap': -.5}], 'gap')
        self.assertEqual((result['wins'], result['ties'], result['losses']), (1, 1, 1))
        self.assertAlmostEqual(result['strict_pairwise_accuracy'], 1 / 3)
        self.assertEqual(result['tie_adjusted_pairwise_accuracy'], .5)
        self.assertAlmostEqual(result['mean_gap'], 1 / 6)

    def test_rule_baseline_retains_phrase_boundaries_and_literal_skill_names(self):
        activity = {'title': 'Bảo vệ MÔI TRƯỜNG', 'description': 'Trồng cây', 'required_skills': ['Trồng cây']}
        self.assertEqual(rule_score({'skills': ['Trồng cây'], 'interests': ['moi truong']}, activity), 70)
        self.assertEqual(rule_score({'skills': [], 'interests': ['trườ']}, activity), 0)
        self.assertEqual(profile_text({'skills': [], 'interests': []}), '')

    def test_batch_alignment_diagnostics_and_scores_come_from_provider(self):
        case = {'id': 'one', 'kind': 'paraphrase', 'profile': {'skills': ['Nấu ăn'], 'interests': []},
                'positive': {'title': 'Bếp sẻ chia', 'description': '', 'required_skills': []},
                'negative': {'title': 'Trồng cây', 'description': '', 'required_skills': []}}
        data = {'version': 1, 'provenance': 'synthetic', 'limitations': ['small'], 'cases': [case],
                'diagnostics': [
                    {'id': 'empty', 'profile': {'skills': [], 'interests': []}, 'activity': case['positive'], 'expectation': 'skip'},
                    {'id': 'negation', 'profile': case['profile'], 'activity': case['negative'], 'expectation': 'report'},
                ]}
        calls = []
        def provider(texts):
            calls.append(texts)
            return [[1, 0], [0, 1], [1, 0], [1, 0], [-1, 0]]
        report = evaluate(data, provider)
        self.assertEqual(calls, [[profile_text(case['profile']), activity_text(case['positive']),
                                 activity_text(case['negative']), profile_text(case['profile']), activity_text(case['negative'])]])
        self.assertEqual(report['semantic']['losses'], 1)
        self.assertEqual(report['semantic']['strict_pairwise_accuracy'], 0)
        self.assertEqual(report['cases'][0]['cosine_gap'], -1)
        self.assertEqual(report['diagnostics'], [{'id': 'negation', 'cosine': -1, 'expectation': 'report'}])
        self.assertEqual(report['groups']['paraphrase']['semantic'], report['semantic'])
        with self.assertRaisesRegex(ValueError, 'different number'):
            evaluate(data, lambda texts: [[1, 0]])

    def test_fixture_is_unique_balanced_and_contains_no_real_identity_fields(self):
        root = Path(__file__).resolve().parent.parent
        data = json.loads((root / 'document' / 'AI_GHEP_NOI_DANH_GIA.json').read_text(encoding='utf-8'))
        self.assertEqual(len(data['cases']), 20)
        self.assertEqual(len({case['id'] for case in data['cases']}), 20)
        self.assertEqual(sum(case['kind'] == 'literal_control' for case in data['cases']), 5)
        self.assertEqual(sum(case['kind'] == 'paraphrase' for case in data['cases']), 15)
        for case in data['cases']:
            self.assertEqual(set(case['profile']), {'skills', 'interests'})
            positive = rule_score(case['profile'], case['positive'])
            negative = rule_score(case['profile'], case['negative'])
            if case['kind'] == 'literal_control':
                self.assertGreater(positive, negative)
            else:
                self.assertEqual(positive, negative)


if __name__ == '__main__':
    unittest.main()
