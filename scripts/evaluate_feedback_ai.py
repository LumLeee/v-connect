"""Opt-in diagnostic evaluation of the real, offline feedback embedding model.

Uses only the checked-in synthetic Vietnamese fixture and no database. This
reports observed errors and abstentions; it does not tune the classifier or
establish production accuracy. Prepare the pinned local model before running:
    .venv\\Scripts\\python.exe scripts/evaluate_feedback_ai.py --output tmp/feedback-ai-evaluation.json
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
SENTIMENTS = ('positive', 'neutral', 'negative', 'uncertain')
FLAGS = ('spam', 'incident')
FLAG_KEYS = {'spam_review': 'spam', 'safety_review': 'incident'}


def _ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def sentiment_metrics(rows):
    """Keep abstention visible rather than dropping hard examples from accuracy."""
    confusion = {label: {prediction: 0 for prediction in SENTIMENTS} for label in SENTIMENTS}
    for row in rows:
        confusion[row['expected_sentiment']][row['predicted_sentiment']] += 1
    details = {}
    for label in SENTIMENTS:
        tp = confusion[label][label]
        support = sum(confusion[label].values())
        predicted = sum(confusion[expected][label] for expected in SENTIMENTS)
        precision, recall = _ratio(tp, predicted), _ratio(tp, support)
        details[label] = {
            'support': support, 'predicted': predicted, 'precision': precision,
            'recall': recall, 'f1': 2 * tp / (support + predicted) if support + predicted else None,
        }
    known = [row for row in rows if row['expected_sentiment'] != 'uncertain']
    answered = [row for row in known if row['predicted_sentiment'] != 'uncertain']
    f1_values = [details[label]['f1'] for label in SENTIMENTS if details[label]['f1'] is not None]
    return {
        'cases': len(rows),
        'exact_accuracy_including_uncertain': _ratio(sum(row['expected_sentiment'] == row['predicted_sentiment'] for row in rows), len(rows)),
        'abstentions': sum(row['predicted_sentiment'] == 'uncertain' for row in rows),
        'known_label_coverage': _ratio(len(answered), len(known)),
        'known_label_answered_accuracy': _ratio(sum(row['expected_sentiment'] == row['predicted_sentiment'] for row in answered), len(answered)),
        'macro_f1_including_uncertain': sum(f1_values) / len(f1_values) if f1_values else None,
        'confusion': confusion, 'per_class': details,
    }


def flag_metrics(rows, predicted_key='predicted_flags'):
    report = {}
    for flag in FLAGS:
        tp = sum(flag in row['expected_flags'] and flag in row[predicted_key] for row in rows)
        fp = sum(flag not in row['expected_flags'] and flag in row[predicted_key] for row in rows)
        fn = sum(flag in row['expected_flags'] and flag not in row[predicted_key] for row in rows)
        tn = len(rows) - tp - fp - fn
        report[flag] = {'true_positive': tp, 'false_positive': fp, 'false_negative': fn,
                        'true_negative': tn, 'precision': _ratio(tp, tp + fp), 'recall': _ratio(tp, tp + fn)}
    return report


def evaluate(data, classify):
    cases, diagnostics = data['cases'], data.get('diagnostics', [])
    combined = [*cases, *diagnostics]
    started = time.monotonic()
    result = classify([case['content'] for case in combined])
    elapsed = time.monotonic() - started
    if result.get('ai', {}).get('status') != 'active':
        raise RuntimeError('The real model was not active: ' + str(result.get('ai', {}).get('reason') or 'unknown'))
    if result.get('truncated'):
        raise ValueError('The benchmark batch was truncated; do not report partial quality metrics.')
    items = result.get('items', [])
    if len(items) != len(combined):
        raise ValueError('Classifier returned a different number of items than inputs.')
    rows, diagnostic_rows = [], []
    for index, (case, item) in enumerate(zip(combined, items)):
        sentiment = item.get('sentiment') or {}
        prediction = sentiment.get('key')
        raw_flags = [flag.get('key') for flag in item.get('flags', [])]
        predicted_flags = {FLAG_KEYS.get(flag, flag) for flag in raw_flags}
        if prediction not in SENTIMENTS or any(flag not in FLAGS for flag in predicted_flags):
            raise ValueError('Classifier returned an unknown sentiment or review flag.')
        predicted_flags = sorted(predicted_flags)
        row = {'id': case['id'], 'expected_flags': case.get('expected_flags', []),
               'predicted_flags': predicted_flags,
               'predicted_ai_flags': sorted({FLAG_KEYS.get(flag.get('key'), flag.get('key'))
                                             for flag in item.get('flags', []) if flag.get('source') == 'ai'}),
               'predicted_rule_flags': sorted({FLAG_KEYS.get(flag.get('key'), flag.get('key'))
                                               for flag in item.get('flags', []) if flag.get('source') == 'rules'}),
               'ai_supported_rule_flags': sorted({FLAG_KEYS.get(flag.get('key'), flag.get('key'))
                                                  for flag in item.get('flags', [])
                                                  if flag.get('source') == 'rules' and flag.get('ai_supported')}),
               'flag_origins': {FLAG_KEYS.get(flag.get('key'), flag.get('key')): flag.get('source', 'unspecified')
                                for flag in item.get('flags', [])}}
        if index < len(cases):
            row.update(expected_sentiment=case['expected_sentiment'], predicted_sentiment=prediction,
                       similarity=sentiment.get('similarity'), margin=sentiment.get('margin'))
            rows.append(row)
        else:
            row.update(purpose=case.get('purpose', ''), predicted_sentiment=prediction)
            diagnostic_rows.append(row)
    return {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'dataset_version': data['version'], 'provenance': data['provenance'],
        'limitations': data['limitations'], 'ai': result['ai'],
        'elapsed_seconds': elapsed, 'sentiment': sentiment_metrics(rows),
        'review_flags_all_cases': flag_metrics([*rows, *diagnostic_rows]),
        'review_flags_diagnostics_only': flag_metrics(diagnostic_rows),
        'review_flags_by_origin': {
            'rules': flag_metrics([*rows, *diagnostic_rows], 'predicted_rule_flags'),
            'ai': flag_metrics([*rows, *diagnostic_rows], 'predicted_ai_flags'),
        },
        'cases': rows, 'diagnostics': diagnostic_rows,
        'rating_usage': 'Fixture ratings are deliberately not sent to the text classifier. Two cases contradict rating and text.',
        'interpretation': 'Cosine similarity and margin are model signals, not calibrated probabilities. All review flags need human verification.',
        'flag_origin_interpretation': 'A rule-triggered flag stays a rule flag even when embeddings support it. AI-supported rule flags are not counted as independently AI-triggered flags.',
    }


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='backslashreplace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, default=ROOT / 'document' / 'AI_PHAN_HOI_DANH_GIA_V2.json')
    parser.add_argument('--output', type=Path, help='Optional JSON report path.')
    args = parser.parse_args(argv)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.environ.setdefault('DJANGO_SECRET_KEY', 'synthetic-feedback-evaluation-no-database-key')
    os.environ.setdefault('DB_PASSWORD', 'unused-feedback-evaluation-no-database')
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
    sys.path.insert(0, str(ROOT / 'backend'))
    import django
    django.setup()
    from apps.feedback.ai import classify_feedback_texts
    try:
        data = json.loads(args.dataset.read_text(encoding='utf-8'))
        if not data.get('cases'):
            raise ValueError('Dataset must include at least one labelled case.')
        identifiers = [case['id'] for case in [*data['cases'], *data.get('diagnostics', [])]]
        if len(set(identifiers)) != len(identifiers):
            raise ValueError('Fixture case IDs must be unique.')
        report = evaluate(data, classify_feedback_texts)
        report['dataset_sha256'] = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
        report['dataset_role'] = ('Independent v2 holdout frozen before reading the revised review rules. '
                                  'Do not tune on this data; changed algorithms require a new holdout.'
                                  if data['version'] == '2026-11-09-v2-independent-holdout' else
                                  'Diagnostic only. The original v1 informed addition of review rules and is now development data.')
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, RuntimeError) as problem:
        print('Feedback AI evaluation failed: ' + str(problem), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
