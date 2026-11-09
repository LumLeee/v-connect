"""Source-grounded factual drafts with local extractive feedback summarization.

MiniLM selects verbatim excerpts. It does not invent prose, outcomes or statistics;
the narrative surrounding those excerpts is an explicit deterministic template.
"""
import hashlib
import json
import math

from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.feedback.services import visible_feedback
from apps.recommendations.embeddings import (
    EMBEDDING_DIMENSIONS, MODEL_NAME, MODEL_REVISION, EmbeddingUnavailable, embed_texts,
)
from .summary_document import summary_data
from .views import IsManager


class DraftRequest(StrictFieldsMixin, serializers.Serializer):
    # Only an optional version check; clients cannot inject facts or instructions.
    expected_source_fingerprint = serializers.RegexField(r'^[0-9a-f]{64}$', required=False)


class SourceChanged(APIException):
    status_code = 409
    default_detail = 'Dữ liệu nguồn đã thay đổi. Hãy làm mới báo cáo rồi tạo lại bản nháp.'
    default_code = 'source_changed'


def _feedback_rows(activity_id, limit):
    return list(visible_feedback().filter(attendance__participation__activity_id=activity_id)
                .order_by('-created_at', '-id').values('id', 'rating', 'content')[:limit])


def _snapshot(user, pk, limit):
    facts = summary_data(user, pk)
    rows = _feedback_rows(pk, limit)
    fingerprint = hashlib.sha256(json.dumps({
        'facts': facts['source_fingerprint'], 'feedback': rows, 'limit': limit,
    }, sort_keys=True, ensure_ascii=False, default=str).encode('utf-8')).hexdigest()
    return facts, rows, fingerprint


def _chunks(text):
    """Verbatim spans: at most three short chunks, without hiding truncation."""
    text = text.strip()
    result = []
    cursor = 0
    # <= 240 characters reduces loss from this model's 128-token limit.
    while cursor < len(text) and len(result) < 3:
        end = min(cursor + 240, len(text))
        if end < len(text):
            boundary = max(text.rfind(mark, cursor + 80, end) for mark in ('. ', '! ', '? ', '\n', ' '))
            if boundary > cursor:
                end = boundary + 1
        value = text[cursor:end].strip()
        if value:
            result.append(value)
        cursor = end
    return result, cursor < len(text)


def _vectors(texts):
    values = embed_texts(texts)
    if len(values) != len(texts):
        raise EmbeddingUnavailable('invalid_output')
    normalized = []
    for vector in values:
        try:
            numbers = [float(value) for value in vector]
            norm = math.hypot(*numbers)
            if len(numbers) != EMBEDDING_DIMENSIONS or not math.isfinite(norm) or norm <= 0:
                raise ValueError
            if not all(math.isfinite(value) for value in numbers):
                raise ValueError
            normalized.append([value / norm for value in numbers])
        except (TypeError, ValueError, OverflowError):
            raise EmbeddingUnavailable('invalid_output') from None
    return normalized


def select_evidence(rows):
    """Centroid relevance plus diversity; include contrasting star ratings."""
    candidates, truncated = [], False
    for row in rows:
        chunks, clipped = _chunks(row['content'])
        truncated |= clipped
        candidates.extend({'feedback_id': str(row['id']), 'quote': chunk, 'rating': row['rating']}
                          for chunk in chunks)
    if not candidates:
        return [], truncated
    texts = list(dict.fromkeys(item['quote'] for item in candidates))
    if len(texts) > settings.MATCHING_AI_MAX_TEXTS:
        raise EmbeddingUnavailable('batch_too_large')
    encoded = _vectors(texts)
    lookup = dict(zip(texts, encoded))
    vectors = [lookup[item['quote']] for item in candidates]
    centroid = [math.fsum(row[index] for row in vectors) / len(vectors)
                for index in range(EMBEDDING_DIMENSIONS)]
    centroid_norm = math.hypot(*centroid)
    if centroid_norm > 0:
        centroid = [value / centroid_norm for value in centroid]
    def cosine(left, right):
        return math.fsum(a * b for a, b in zip(left, right))
    relevance = [cosine(vector, centroid) for vector in vectors]
    selected, used, seen_quotes = [], set(), set()
    def choose(pool):
        eligible = [index for index in pool if candidates[index]['feedback_id'] not in used
                    and candidates[index]['quote'] not in seen_quotes]
        if not eligible:
            return
        def score(index):
            redundancy = max((cosine(vectors[index], vectors[prior]) for prior in selected), default=0)
            return .7 * relevance[index] - .3 * redundancy
        index = max(eligible, key=lambda item: (score(item), -item))
        selected.append(index)
        used.add(candidates[index]['feedback_id'])
        seen_quotes.add(candidates[index]['quote'])
    # Star buckets are source data, never model-derived sentiment claims.
    choose(range(len(candidates)))
    choose([index for index, row in enumerate(candidates) if row['rating'] <= 2])
    choose([index for index, row in enumerate(candidates) if row['rating'] >= 4])
    while len(selected) < min(4, len(rows)):
        previous = len(selected)
        choose(range(len(candidates)))
        if len(selected) == previous:
            break
    return [candidates[index] for index in selected], truncated


def _draft(facts, evidence):
    activity, metrics, contributions = (facts[key] for key in ('activity', 'metrics', 'contributions'))
    feedback = metrics['feedback']
    average = 'Chưa có điểm đánh giá trung bình.' if feedback['average_rating'] is None else f"Điểm đánh giá trung bình là {feedback['average_rating']}/5."
    sections = [
        {'key': 'scope', 'title': 'Phạm vi báo cáo',
         'text': f"Báo cáo tổng kết hoạt động “{activity['title']}”, trạng thái Hoàn thành. Bản nháp sử dụng dữ liệu được ghi nhận trên V-Connect tại thời điểm tạo; chưa xác nhận các kết quả ngoài hệ thống.",
         'source_refs': [], 'source_fields': ['activity.title', 'activity.status']},
        {'key': 'participation', 'title': 'Đăng ký và tham gia',
         'text': f"Hoạt động ghi nhận {metrics['registered']} đơn đăng ký: {metrics['approved']} được duyệt, {metrics['pending']} chờ duyệt, {metrics['rejected']} bị từ chối và {metrics['cancelled']} đã hủy. Có {metrics['attended_completed']} người được duyệt và đã điểm danh.",
         'source_refs': [], 'source_fields': ['metrics']},
        {'key': 'contributions', 'title': 'Đóng góp được ghi nhận',
         'text': f"Tổng điểm đóng góp đã được chấm là {contributions['score']}; {contributions['confirmed']} người đã được xác nhận đóng góp và {contributions['pending']} người đã điểm danh còn chờ xác nhận. Đây là điểm do Nhà tổ chức chấm, không phải số giờ hoặc số người thụ hưởng.",
         'source_refs': [], 'source_fields': ['contributions']},
        {'key': 'feedback', 'title': 'Phản hồi của người tham gia',
         'text': f"Hệ thống ghi nhận {feedback['count']} phản hồi hợp lệ, không tính phản hồi bị ẩn. {average}" +
                 ('\nCác trích dẫn được chọn để đối chiếu, không đại diện cho toàn bộ người tham gia:\n' +
                  '\n'.join(f"• {item['quote']}" for item in evidence) if evidence else
                  '\nChưa có phần trích dẫn được AI chọn trong bản nháp này.'),
         'source_refs': [item['feedback_id'] for item in evidence], 'source_fields': ['metrics.feedback']},
        {'key': 'review', 'title': 'Nội dung cần kiểm tra trước khi sử dụng',
         'text': 'Đối chiếu số liệu, đọc phản hồi gốc và bổ sung kết quả thực tế có bằng chứng trước khi phát hành. Không suy số người thụ hưởng, chi phí, tác động xã hội hoặc mức hài lòng của người không gửi phản hồi từ các số liệu này.',
         'source_refs': [], 'source_fields': []},
    ]
    return {'title': f"Báo cáo tổng kết: {activity['title']}", 'sections': sections}


def create_draft(user, pk, expected=None):
    try:
        limit = int(settings.REPORT_AI_MAX_FEEDBACK)
        valid_config = 1 <= limit <= 80
    except (TypeError, ValueError):
        valid_config, limit = False, 40
    if not valid_config:
        limit = 40
    facts, rows, fingerprint = _snapshot(user, pk, limit)
    if expected and expected != facts['source_fingerprint']:
        raise SourceChanged()
    status, reason, evidence, clipped = 'not_applicable', None, [], False
    if not settings.REPORT_AI_ENABLED:
        status = 'disabled'
    elif not valid_config:
        status, reason = 'fallback', 'configuration'
    elif rows:
        try:
            evidence, clipped = select_evidence(rows)
            status = 'active' if evidence else 'not_applicable'
        except EmbeddingUnavailable as problem:
            allowed = {'disabled', 'configuration', 'dependencies_missing', 'model_missing', 'model_invalid',
                       'busy', 'timeout', 'invalid_input', 'batch_too_large', 'invalid_output', 'inference_failed'}
            reason = problem.reason if problem.reason in allowed else 'inference_failed'
            status = 'disabled' if reason == 'disabled' else 'fallback'
        except Exception:
            status, reason = 'fallback', 'inference_failed'
    # Hide/changes during inference must never return a quote from the old scope.
    if _snapshot(user, pk, limit)[2] != fingerprint:
        raise SourceChanged()
    return {
        'method': 'local_extractive_report_v1' if status == 'active' else 'facts_template_v1',
        'ai': {'status': status, 'reason': reason, 'model': MODEL_NAME if status == 'active' else None,
               'revision': MODEL_REVISION if status == 'active' else None},
        'generated_at': timezone.now(), 'source_fingerprint': fingerprint,
        'source': {'activity_id': str(pk), 'activity': facts['activity'], 'summary_fingerprint': facts['source_fingerprint'],
                   'generated_at': facts['generated_at'], 'feedback_count': facts['metrics']['feedback']['count'],
                   'analyzed_count': len(rows) if status == 'active' else 0,
                   'truncated': facts['metrics']['feedback']['count'] > len(rows) or clipped,
                   'metrics': facts['metrics'], 'contributions': facts['contributions']},
        'draft': _draft(facts, evidence), 'evidence': evidence,
        'limitations': [
            'Bản nháp cần được người dùng kiểm tra; không tự lưu hoặc phát hành.',
            'Số liệu và các đoạn nối dùng mẫu cố định; AI chỉ chọn trích dẫn nguyên văn bằng embedding, không phải mô hình sinh văn bản.',
            f'AI xét tối đa {limit} phản hồi hợp lệ mới nhất, tối đa 3 đoạn ngắn mỗi phản hồi; không kết luận về toàn bộ người tham gia.',
            'Nhãn sao là dữ liệu người gửi; không phải nhãn cảm xúc do AI xác nhận.',
        ],
    }


@method_decorator(never_cache, name='dispatch')
class ActivityAIDraft(APIView):
    permission_classes = [IsAuthenticated, IsManager]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_analysis'

    def post(self, request, pk):
        serializer = DraftRequest(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(create_draft(request.user, pk, serializer.validated_data.get('expected_source_fingerprint')))
