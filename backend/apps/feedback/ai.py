"""Advisory analysis using local multilingual embeddings, never moderation.

The encoder is not a trained sentiment classifier. Similarity to fixed example
sentences is useful for grouping feedback; weak, mixed and negated text abstains.
Only feedback text reaches the shared offline model, never account information.
"""
import hashlib
import json
import math
import re
from collections import Counter

from django.conf import settings
from django.utils import timezone

from apps.recommendations.embeddings import (
    EMBEDDING_DIMENSIONS, MODEL_NAME, MODEL_REVISION, EmbeddingUnavailable,
    embed_texts, normalized_vectors,
)

SENTIMENT_LABELS = {
    'positive': 'Tích cực', 'neutral': 'Trung tính',
    'negative': 'Cần cải thiện', 'uncertain': 'Chưa rõ',
}
# Fixed before evaluating the independent Vietnamese fixture. These examples are
# semantic reference points, not training data or probabilities.
SENTIMENT_PROTOTYPES = {
    'positive': (
        'Tôi rất hài lòng với hoạt động tình nguyện này, mọi người hỗ trợ rất tốt.',
        'Chương trình bổ ích và ý nghĩa, ban tổ chức thân thiện, tôi muốn tham gia lại.',
        'Cảm ơn đội ngũ đã chuẩn bị chu đáo, tôi có một trải nghiệm tuyệt vời.',
    ),
    'neutral': (
        'Tôi tham gia hoạt động vào buổi sáng và ra về sau khi kết thúc chương trình.',
        'Nhóm tập trung tại địa điểm, nhận nhiệm vụ rồi thực hiện theo kế hoạch.',
        'Chương trình gồm phần hướng dẫn, thực hành và tổng kết cuối buổi.',
    ),
    'negative': (
        'Tôi không hài lòng với hoạt động này, khâu tổ chức kém và cần cải thiện.',
        'Tôi thất vọng vì chương trình lộn xộn, thiếu hỗ trợ và làm mất thời gian.',
        'Trải nghiệm rất tệ, chuẩn bị thiếu chu đáo và tôi không muốn tham gia lại.',
    ),
}
TOPIC_PROTOTYPES = {
    'organization': ('Tổ chức và hướng dẫn', (
        'Ban tổ chức phân công nhiệm vụ, hướng dẫn người tham gia và điều phối nhóm.',
        'Cách tổ chức chương trình và sự hỗ trợ của điều phối viên.',
    )),
    'schedule': ('Lịch trình', (
        'Chương trình bắt đầu trễ, thay đổi thời gian và cần thông báo lịch trình rõ hơn.',
        'Thời gian tập trung, thời lượng làm việc và giờ kết thúc hoạt động.',
    )),
    'resources': ('Dụng cụ và hậu cần', (
        'Cần chuẩn bị dụng cụ, vật tư, găng tay, nước uống và đồ ăn cho người tham gia.',
        'Phương tiện di chuyển, địa điểm và trang thiết bị phục vụ hoạt động.',
    )),
    'communication': ('Giao tiếp và phối hợp', (
        'Mọi người giao tiếp thân thiện, phối hợp làm việc và trao đổi thông tin trong nhóm.',
        'Thông báo cho người tham gia rõ ràng và giải đáp thắc mắc kịp thời.',
    )),
    'safety': ('An toàn', (
        'Cần bảo đảm an toàn, sơ cứu khi tai nạn và bảo vệ người tham gia khỏi nguy hiểm.',
        'Trang bị bảo hộ và hướng dẫn phòng tránh rủi ro trong quá trình hoạt động.',
    )),
    'impact': ('Ý nghĩa và kết quả', (
        'Hoạt động giúp ích cộng đồng, mang lại kết quả thiết thực và tạo trải nghiệm ý nghĩa.',
        'Tôi học được kỹ năng mới và mong muốn tiếp tục đóng góp cho cộng đồng.',
    )),
}
FLAG_PROTOTYPES = {
    'safety_review': ('Cần xem lại phản ánh về an toàn', (
        'Trong hoạt động có người bị thương hoặc gặp tai nạn, cần người phụ trách kiểm tra.',
        'Tôi bị quấy rối, đe dọa hoặc cảm thấy mất an toàn khi tham gia.',
    )),
    'spam_review': ('Cần xem lại nội dung quảng cáo', (
        'Mua hàng khuyến mãi, vay tiền lãi suất thấp, nhấn đường link để nhận thưởng ngay.',
        'Đây là quảng cáo bán hàng, liên hệ số điện thoại và truy cập website để mua sản phẩm.',
    )),
}
SAFE_REASONS = {
    'disabled', 'configuration', 'dependencies_missing', 'model_missing',
    'model_invalid', 'busy', 'timeout', 'invalid_input', 'batch_too_large',
    'invalid_output', 'inference_failed',
}
LIMITATIONS = [
    'Nhãn được gợi ý bằng độ tương đồng với câu mẫu; đây không phải mô hình phân loại cảm xúc đã huấn luyện riêng.',
    'Độ tương đồng không phải xác suất đúng. Phủ định, mỉa mai và nội dung có nhiều ý cần người đọc kiểm tra.',
    'Nội dung được trích từ phản hồi trong phạm vi đã chọn; không tự ẩn phản hồi hoặc thay đổi dữ liệu.',
    'Không có cờ cảnh báo không có nghĩa là phản hồi không chứa sự cố hoặc quảng cáo; vẫn cần đọc nội dung gốc.',
]
_NEGATION = re.compile(r'\b(không|chưa|chẳng|chả|khỏi|đâu có|không hề)\b', re.I)
_MIXED = re.compile(r'\b(nhưng|tuy nhiên|mặc dù|dù vậy|tuy vậy)\b', re.I)
_INCIDENT = re.compile(r'\b(bị thương|tai nạn|quấy rối|đe dọa|mất an toàn|lừa đảo)\b', re.I)
_COMMERCIAL = re.compile(r'\b(mua|bán|vay tiền|cho vay|khuyến mãi|giảm giá|nhận thưởng|trúng thưởng|kiếm tiền|đầu tư)\b', re.I)
_COMMERCIAL_ACTION = re.compile(r'https?://|www\.|\b(liên hệ|nhắn tin|gọi ngay|đăng ký ngay|chốt đơn|mua ngay|inbox|zalo|lãi suất|hoa hồng)\b|\d+\s*%|\b\d{9,11}\b', re.I)
_ACTUAL_INCIDENT = re.compile(r'\b(tôi|mình|em|chúng tôi|có người|một người|một bạn|có bạn)\s+(đã\s+)?(bị|gặp)|\b(đã xảy ra|xảy ra lúc|xảy ra khi|xảy ra trong)\b', re.I)
_TRAINING = re.compile(r'\b(hướng dẫn|tập huấn|diễn tập|giả định|phòng tránh|tình huống|đề phòng|nếu)\b', re.I)


def review_rule_flags(text):
    """Transparent review cues, independent of the model and never a verdict."""
    flags = []
    if _COMMERCIAL.search(text) and _COMMERCIAL_ACTION.search(text):
        flags.append({'key': 'spam_review', 'label': FLAG_PROTOTYPES['spam_review'][0], 'source': 'rules'})
    for clause in re.split(r'[.!?;\n]|\bnhưng\b|\btuy nhiên\b', text, flags=re.I):
        for incident in _INCIDENT.finditer(clause):
            before = clause[max(0, incident.start() - 45):incident.start()]
            after = clause[incident.end():incident.end() + 25]
            if _NEGATION.search(before) or re.search(r'\b(không|chưa)\s+(xảy ra|có thật)\b', after, re.I):
                continue
            actual = _ACTUAL_INCIDENT.search(clause)
            if not actual or (_TRAINING.search(clause) and not re.search(r'\b(tôi|mình|em|có người|một bạn)\s+(đã\s+)?bị\b', clause, re.I)):
                continue
            flags.append({'key': 'safety_review', 'label': FLAG_PROTOTYPES['safety_review'][0], 'source': 'rules'})
            return flags
    return flags


def _metadata(status, reason=None):
    return {'status': status, 'reason': reason,
            'model': MODEL_NAME if status == 'active' else None,
            'revision': MODEL_REVISION if status == 'active' else None}


def _dot(left, right):
    return max(-1.0, min(1.0, sum(a * b for a, b in zip(left, right))))


def _chunks(text, max_chars=350):
    """Word-aware spans sized below the encoder's short token window."""
    words = str(text).strip().split()
    chunks, current = [], ''
    for word in words:
        if len(word) > max_chars:
            if current:
                chunks.append(current)
                current = ''
            chunks.extend(word[index:index + max_chars] for index in range(0, len(word), max_chars))
        elif current and len(current) + len(word) + 1 > max_chars:
            chunks.append(current)
            current = word
        else:
            current = f'{current} {word}'.strip()
    if current:
        chunks.append(current)
    return chunks or ['Không có nội dung.']


def _sample(chunks, limit):
    if len(chunks) <= limit:
        return chunks
    if limit == 1:
        return [chunks[0]]
    return [chunks[round(index * (len(chunks) - 1) / (limit - 1))] for index in range(limit)]


def _unknown(text=''):
    return {'sentiment': {'key': 'uncertain', 'similarity': None, 'margin': None},
            'topics': [], 'flags': review_rule_flags(text)}


def _pool(vectors):
    values = [sum(vector[index] for vector in vectors) for index in range(EMBEDDING_DIMENSIONS)]
    norm = math.hypot(*values)
    if not math.isfinite(norm) or norm <= 0:
        raise EmbeddingUnavailable('invalid_output')
    return [value / norm for value in values]


def classify_feedback_texts(texts):
    """Return advisory labels for text only, with a single truthful batch status."""
    if not isinstance(texts, (list, tuple)):
        return {'ai': _metadata('fallback', 'invalid_input'), 'items': [], 'truncated': False}
    if not texts:
        return {'ai': _metadata('not_applicable'), 'items': [], 'truncated': False}
    if any(not isinstance(text, str) or not text.strip() for text in texts):
        return {'ai': _metadata('fallback', 'invalid_input'),
                'items': [_unknown(text if isinstance(text, str) else '') for text in texts],
                'truncated': False}
    fallback = {'ai': _metadata('fallback', 'inference_failed'),
                'items': [_unknown(text) for text in texts], 'truncated': False}
    if not getattr(settings, 'FEEDBACK_AI_ENABLED', True):
        fallback['ai'] = _metadata('disabled', 'disabled')
        return fallback
    try:
        references = list(dict.fromkeys(
            [text for examples in SENTIMENT_PROTOTYPES.values() for text in examples]
            + [text for _, examples in TOPIC_PROTOTYPES.values() for text in examples]
            + [text for _, examples in FLAG_PROTOTYPES.values() for text in examples]))
        maximum = int(getattr(settings, 'MATCHING_AI_MAX_TEXTS', 256))
        if maximum < len(references) + len(texts):
            raise EmbeddingUnavailable('batch_too_large')
        per_text = max(1, min(6, (maximum - len(references)) // len(texts)))
        char_limit = min(350, int(getattr(settings, 'MATCHING_AI_MAX_TEXT_CHARS', 2000)))
        if char_limit < 1 or any(not isinstance(text, str) or not text.strip() for text in texts):
            raise EmbeddingUnavailable('invalid_input')
        all_chunks = [_chunks(text[:2000], max_chars=char_limit) for text in texts]
        chunks = [_sample(parts, per_text) for parts in all_chunks]
        truncated = any(len(original) > len(selected) or len(text) > 2000
                        for original, selected, text in zip(all_chunks, chunks, texts))
        inputs = list(dict.fromkeys(references + [part for parts in chunks for part in parts]))
        vectors = normalized_vectors(embed_texts(inputs), len(inputs))
        lookup = dict(zip(inputs, vectors))
        rows = []
        for text, parts in zip(texts, chunks):
            pooled = _pool([lookup[part] for part in parts])
            similarities = {key: max(_dot(pooled, lookup[example]) for example in examples)
                            for key, examples in SENTIMENT_PROTOTYPES.items()}
            order = sorted(similarities, key=lambda key: (-similarities[key], key))
            top, second = order[:2]
            best, margin = similarities[top], similarities[top] - similarities[second]
            # A semantic encoder does not reliably understand logical negation or
            # mixed praise/criticism. Explicit abstention is safer than a label.
            uncertain = best < .38 or margin < .04 or bool(_NEGATION.search(text) or _MIXED.search(text))
            sentiment = {'key': 'uncertain' if uncertain else top,
                         'similarity': round(best * 100, 1), 'margin': round(margin * 100, 1)}
            topic_scores = {key: max(_dot(pooled, lookup[example]) for example in examples)
                            for key, (_, examples) in TOPIC_PROTOTYPES.items()}
            best_topic = max(topic_scores.values())
            topics = [{'key': key, 'label': TOPIC_PROTOTYPES[key][0]}
                      for key in sorted(topic_scores, key=lambda key: (-topic_scores[key], key))
                      if topic_scores[key] >= .48 and topic_scores[key] >= best_topic - .06][:2]
            flags = review_rule_flags(text)
            # Keep rule cues transparent even if the semantic model is weak or
            # unavailable. Model support is separate from the review decision.
            for key, (_, examples) in FLAG_PROTOTYPES.items():
                score = max(_dot(pooled, lookup[example]) for example in examples)
                for flag in flags:
                    if flag['key'] == key:
                        flag['ai_supported'] = score >= .45
            rows.append({'sentiment': sentiment, 'topics': topics, 'flags': flags})
        return {'ai': _metadata('active'), 'items': rows, 'truncated': truncated}
    except EmbeddingUnavailable as exc:
        reason = exc.reason if exc.reason in SAFE_REASONS else 'inference_failed'
        fallback['ai'] = _metadata('disabled' if reason == 'disabled' else 'fallback', reason)
    except Exception:
        # Never return model errors, file paths, or user content in an error.
        pass
    return fallback


def feedback_source_fingerprint(entries, filters=None):
    rows = sorted((str(entry.pk if hasattr(entry, 'pk') else entry.id), entry.content,
                   entry.rating, str(entry.created_at), bool(getattr(entry, 'is_hidden', False)))
                  for entry in entries)
    source = json.dumps({'rows': rows, 'filters': filters or {}}, ensure_ascii=False,
                        sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(source.encode('utf-8')).hexdigest()


def analyze_feedback_entries(entries, activity_id=None, filters=None, total_count=None, fingerprint=None):
    """Analyze an already-authorized, bounded snapshot. Does not write to DB."""
    entries = list(entries)
    total = len(entries) if total_count is None else total_count
    try:
        limit = int(getattr(settings, 'FEEDBACK_AI_MAX_ITEMS', 40))
        if not 1 <= limit <= 80:
            raise ValueError
    except (TypeError, ValueError):
        limit = 40
    selected = entries[:limit]
    classified = classify_feedback_texts([entry.content for entry in selected])
    active = classified['ai']['status'] == 'active'
    sentiments = Counter(row['sentiment']['key'] for row in classified['items'])
    topics, reviews = {}, []
    for entry, row in zip(selected, classified['items']):
        identifier = str(entry.pk if hasattr(entry, 'pk') else entry.id)
        for topic in row['topics']:
            group = topics.setdefault(topic['key'], {**topic, 'count': 0, 'feedback_ids': []})
            group['count'] += 1
            group['feedback_ids'].append(identifier)
        if row['flags'] or row['sentiment']['key'] == 'uncertain':
            label = ' · '.join(flag['label'] for flag in row['flags']) or 'Cần đọc lại nội dung'
            reviews.append({'feedback_id': identifier, 'content': entry.content[:400], 'label': label,
                            'source': 'rules' if row['flags'] else ('ai' if active else 'manual'),
                            'flags': row['flags'],
                            'reason': 'Quy tắc nhận diện từ ngữ cần xem lại; người phụ trách cần kiểm tra, đây không phải kết luận vi phạm.' if row['flags']
                            else ('Nội dung chưa rõ, có phủ định hoặc nhiều ý; AI chưa gán nhãn.' if active
                                  else 'Chưa có phân tích AI; vui lòng đọc và đánh giá thủ công.')})
    # A small extractive digest keeps every word attributable to an actual source.
    # Select examples from different suggested sentiments; never synthesize facts.
    examples, seen = [], set()
    if active:
        for entry, row in zip(selected, classified['items']):
            key = row['sentiment']['key']
            if key not in seen:
                identifier = str(entry.pk if hasattr(entry, 'pk') else entry.id)
                quote = entry.content[:280]
                examples.append({'feedback_id': identifier, 'quote': quote})
                seen.add(key)
            if len(examples) == 3:
                break
    truncated = total > len(selected) or classified['truncated']
    limits = list(LIMITATIONS)
    if truncated:
        limits.append('Phạm vi lớn hoặc nội dung dài: chỉ phân tích phần mẫu được giới hạn; kết quả không đại diện toàn bộ phản hồi.')
    if not active and selected:
        limits.append('Mô hình chưa tạo được phân tích; các phản hồi được để ở trạng thái Chưa rõ để xem thủ công.')
    return {
        'method': 'local_embedding_prototypes_v1' if active else 'manual_review_v1',
        'ai': classified['ai'], 'generated_at': timezone.now().isoformat(),
        'source_fingerprint': fingerprint or feedback_source_fingerprint(entries, filters),
        'scope': {'activity_id': str(activity_id) if activity_id else None,
                  'feedback_count': total, 'analyzed_count': len(selected),
                  'truncated': truncated, 'filters': filters or {}},
        'summary': {'text': '\n'.join(example['quote'] for example in examples),
                    'source_feedback_ids': [example['feedback_id'] for example in examples],
                    'evidence': examples},
        'sentiments': [{'key': key, 'label': label, 'count': sentiments[key]}
                       for key, label in SENTIMENT_LABELS.items()],
        'topics': sorted(topics.values(), key=lambda topic: (-topic['count'], topic['key'])),
        'review_items': reviews,
        'limitations': limits,
    }
