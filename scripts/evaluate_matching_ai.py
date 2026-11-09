"""Opt-in, database-free Vietnamese matching benchmark with a real local model.

Run after downloading/configuring the model as documented by AI_GHEP_NOI.md:
    .venv\\Scripts\\python.exe scripts/evaluate_matching_ai.py --output tmp/matching-ai-evaluation.json

No test scores are embedded in this file. Provider/model failures exit with code 2.
The hand-labelled fixture is deliberately small and is not a validation dataset
for training, tuning weights or making claims about deployment accuracy.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from types import SimpleNamespace
import unicodedata

ROOT = Path(__file__).resolve().parent.parent


def normalized(value):
    value = unicodedata.normalize('NFD', value.casefold().replace('đ', 'd'))
    return ' '.join(re.findall(r'[a-z0-9]+', ''.join(char for char in value if not unicodedata.combining(char))))


def profile_text(profile):
    return '; '.join([*sorted(profile['skills'], key=str.casefold),
                      *(item.strip() for item in profile['interests'] if item.strip())])[:2000]


def activity_text(activity):
    return '; '.join([activity['title'], *sorted(activity['required_skills'], key=str.casefold),
                      activity['description']])[:2000]


def rule_score(profile, activity):
    """Existing exact-skill/phrase rule baseline; both sides have no availability."""
    required = activity['required_skills']
    skills = set(profile['skills'])
    skills_score = 50 * sum(skill in skills for skill in required) / len(required) if required else 0
    activity_words = f" {normalized(activity['title'] + ' ' + activity['description'])} "
    interests_score = 20 if any(normalized(interest) and f' {normalized(interest)} ' in activity_words
                               for interest in profile['interests']) else 0
    return round(skills_score + interests_score, 6)


def cosine(left, right):
    if not left or len(left) != len(right) or not all(math.isfinite(value) for value in [*left, *right]):
        raise ValueError('Embedding vectors must have the same nonzero dimension and only finite values.')
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        raise ValueError('Embedding vectors must have nonzero norms.')
    return max(-1.0, min(1.0, sum(a * b for a, b in zip(left, right)) / left_norm / right_norm))


def pairwise_summary(rows, key):
    wins = sum(row[key] > 1e-9 for row in rows)
    ties = sum(abs(row[key]) <= 1e-9 for row in rows)
    return {
        'cases': len(rows), 'wins': wins, 'ties': ties, 'losses': len(rows) - wins - ties,
        'strict_pairwise_accuracy': wins / len(rows),
        'tie_adjusted_pairwise_accuracy': (wins + .5 * ties) / len(rows),
        'mean_gap': sum(row[key] for row in rows) / len(rows),
    }


def evaluate(data, embed_texts, profile_builder=profile_text, activity_builder=activity_text, threshold=.35):
    if not math.isfinite(threshold) or not 0 <= threshold < 1:
        raise ValueError('Semantic threshold must be finite and in [0,1).')
    texts = []
    for case in data['cases']:
        texts.extend([profile_builder(case['profile']), activity_builder(case['positive']), activity_builder(case['negative'])])
    diagnostic_cases = [case for case in data.get('diagnostics', []) if profile_builder(case['profile'])]
    for case in diagnostic_cases:
        texts.extend([profile_builder(case['profile']), activity_builder(case['activity'])])
    started = time.monotonic()
    vectors = list(embed_texts(texts))
    elapsed = time.monotonic() - started
    if len(vectors) != len(texts):
        raise ValueError('Provider returned a different number of vectors than inputs.')
    rows = []
    for index, case in enumerate(data['cases']):
        profile, positive, negative = vectors[index * 3:index * 3 + 3]
        positive_similarity, negative_similarity = cosine(profile, positive), cosine(profile, negative)
        positive_rule, negative_rule = rule_score(case['profile'], case['positive']), rule_score(case['profile'], case['negative'])
        positive_hybrid = round(.7 * positive_rule + round(30 * max(0, (positive_similarity - threshold) / (1 - threshold)), 2), 2)
        negative_hybrid = round(.7 * negative_rule + round(30 * max(0, (negative_similarity - threshold) / (1 - threshold)), 2), 2)
        rows.append({
            'id': case['id'], 'kind': case.get('kind', 'unspecified'),
            'positive_cosine': positive_similarity, 'negative_cosine': negative_similarity,
            'cosine_gap': positive_similarity - negative_similarity,
            'positive_rule_score': positive_rule, 'negative_rule_score': negative_rule,
            'rule_gap': positive_rule - negative_rule,
            'positive_hybrid_score': positive_hybrid, 'negative_hybrid_score': negative_hybrid,
            'hybrid_gap': positive_hybrid - negative_hybrid,
        })
    diagnostics = []
    offset = len(data['cases']) * 3
    for index, case in enumerate(diagnostic_cases):
        diagnostics.append({'id': case['id'], 'cosine': cosine(vectors[offset + index * 2], vectors[offset + index * 2 + 1]),
                            'expectation': case['expectation']})
    return {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'dataset_version': data['version'], 'provenance': data['provenance'],
        'limitations': data['limitations'],
        'model': os.environ.get('MATCHING_AI_MODEL', 'configured local embedding provider'),
        'text_representation': 'profile skills/interests; activity title/description/required skills; no availability or personal/contact fields',
        'embedding_elapsed_seconds': elapsed,
        'semantic_threshold': threshold,
        'semantic': pairwise_summary(rows, 'cosine_gap'),
        'rules_baseline': pairwise_summary(rows, 'rule_gap'),
        'hybrid': pairwise_summary(rows, 'hybrid_gap'),
        'groups': {kind: {
            'semantic': pairwise_summary([row for row in rows if row['kind'] == kind], 'cosine_gap'),
            'rules_baseline': pairwise_summary([row for row in rows if row['kind'] == kind], 'rule_gap'),
            'hybrid': pairwise_summary([row for row in rows if row['kind'] == kind], 'hybrid_gap'),
        } for kind in sorted({row['kind'] for row in rows})},
        'cases': rows, 'diagnostics': diagnostics,
        'blank_profile': 'Excluded from embeddings; verify no AI-only match in application unit tests.',
    }


def main(argv=None):
    # Windows consoles may default to cp1252; the report contains Vietnamese.
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, default=ROOT / 'document' / 'AI_GHEP_NOI_DANH_GIA.json')
    parser.add_argument('--output', type=Path, help='Optional JSON report; creates its parent directory.')
    parser.add_argument('--minimum-accuracy', type=float, help='Optional strict hybrid-ranking acceptance threshold (0..1).')
    args = parser.parse_args(argv)
    if args.minimum_accuracy is not None and not 0 <= args.minimum_accuracy <= 1:
        parser.error('--minimum-accuracy must be between 0 and 1')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.environ.setdefault('DJANGO_SECRET_KEY', 'synthetic-evaluation-no-database-key')
    os.environ.setdefault('DB_PASSWORD', 'unused-evaluation-no-database')
    sys.path.insert(0, str(ROOT / 'backend'))
    import django
    django.setup()
    from django.conf import settings
    from apps.recommendations.embeddings import EmbeddingUnavailable, MODEL_REVISION, embed_texts
    from apps.reports.matching import activity_text as configured_activity_text, profile_text as configured_profile_text

    def related(names):
        values = [SimpleNamespace(name=name) for name in names]
        return SimpleNamespace(all=lambda: values)

    def current_profile(value):
        return configured_profile_text(SimpleNamespace(skills=related(value['skills']), interests=value['interests']))

    def current_activity(value):
        return configured_activity_text(SimpleNamespace(title=value['title'], description=value['description'],
                                                        required_skills=related(value['required_skills'])))
    try:
        with args.dataset.open(encoding='utf-8') as dataset_file:
            data = json.load(dataset_file)
        if not data.get('cases'):
            raise ValueError('Dataset must contain at least one labelled case.')
        report = evaluate(data, embed_texts, current_profile, current_activity, settings.MATCHING_AI_MIN_SIMILARITY)
        report['model'] = settings.MATCHING_AI_MODEL
        report['model_revision'] = MODEL_REVISION
        report['dataset_sha256'] = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    except (EmbeddingUnavailable, ValueError, OSError) as exc:
        print(f'Evaluation could not run: {type(exc).__name__}: {exc}', file=sys.stderr)
        return 2
    payload = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + '\n', encoding='utf-8')
    print(payload)
    if args.minimum_accuracy is not None and report['hybrid']['strict_pairwise_accuracy'] < args.minimum_accuracy:
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
