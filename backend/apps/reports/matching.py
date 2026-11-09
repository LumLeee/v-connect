"""Eligible matches ranked by local multilingual embeddings and explainable rules."""
import math
import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db.models import Count, Prefetch, Q
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import VolunteerProfile
from apps.activities.models import Activity
from apps.activities.time_policy import enabled
from apps.activities.serializers import ActivitySerializer
from apps.activities.views import IsOrganizer
from apps.core.pagination import StandardPagination
from apps.participations.models import Invitation, Participation
from apps.participations.views import IsVolunteer
from apps.recommendations.embeddings import MODEL_REVISION, EmbeddingUnavailable, embed_texts

ZONE = ZoneInfo('Asia/Ho_Chi_Minh')
ANCHOR = datetime(1970, 1, 5, tzinfo=ZONE)
WEEK = 7 * 86400
METHOD = 'rules_v1'
RULE_LIMITS = {'skills': 50, 'interests': 20, 'availability': 30}
AI_LIMITS = {'skills': 35, 'interests': 14, 'availability': 21, 'semantic': 30}
AI_FAILURE_CODES = {
    'disabled', 'configuration', 'dependencies_missing', 'model_missing', 'model_invalid',
    'busy', 'timeout', 'invalid_input', 'batch_too_large', 'invalid_output',
    'inference_failed', 'invalid_vectors', 'input_limit', 'invalid_configuration',
}


def matching_metadata(status, reason=None):
    active = status == 'active'
    return {
        'method': 'hybrid_embeddings_v1' if active else METHOD,
        'ai': {'status': status, 'reason': reason, 'model': settings.MATCHING_AI_MODEL if active else None,
               'revision': MODEL_REVISION if active else None},
        'component_limits': dict(AI_LIMITS if active else RULE_LIMITS),
        'explanation': (
            'Điểm kết hợp /100: kỹ năng tối đa 35, sở thích 14, lịch rảnh 21, tương đồng nội dung bằng AI 30. '
            'Embedding đa ngôn ngữ chạy trực tiếp trên backend; kỹ năng chỉ được đánh dấu khi khớp hồ sơ. '
            'Điểm và phần trăm tương đồng không phải xác suất được duyệt.' if active else
            'Điểm quy tắc /100: kỹ năng tối đa 50, sở thích 20, lịch rảnh 30. '
            'Kết quả này chưa áp dụng AI; không phải xác suất được duyệt.'
        ),
    }


def profile_text(profile):
    """Only declared matching fields, never identity, contact details or free-text bio."""
    if not profile:
        return ''
    skills = sorted((skill.name for skill in profile.skills.all()), key=str.casefold)
    interests = [item.strip() for item in profile.interests if item.strip()]
    return '; '.join([*skills, *interests])[:settings.MATCHING_AI_MAX_TEXT_CHARS]


def activity_text(activity):
    skills = sorted((skill.name for skill in activity.required_skills.all()), key=str.casefold)
    return '; '.join([activity.title, *skills, activity.description])[:settings.MATCHING_AI_MAX_TEXT_CHARS]


def _unit_vector(vector):
    if not isinstance(vector, (list, tuple)) or len(vector) != 384:
        raise EmbeddingUnavailable('invalid_vectors')
    try:
        values = [float(value) for value in vector]
        norm = math.hypot(*values)
        if not all(math.isfinite(value) for value in values) or not math.isfinite(norm) or norm <= 0:
            raise ValueError
        return [value / norm for value in values]
    except (ValueError, TypeError, OverflowError):
        raise EmbeddingUnavailable('invalid_vectors')


def rank_matches(pairs):
    """Return one match per eligible (activity, profile), then shared scoring metadata.

    Apply AI to the whole list before pagination. Failure always restores the
    original formula for the entire response, never a mixture of scoring scales.
    """
    rules = [evaluate(activity, profile) for activity, profile in pairs]
    if not settings.MATCHING_AI_ENABLED:
        return rules, matching_metadata('disabled')
    if not pairs:
        return rules, matching_metadata('not_applicable')
    texts, indexes = [], {}
    positions = []
    def remember(value):
        if value not in indexes:
            indexes[value] = len(texts)
            texts.append(value)
        return indexes[value]
    for activity, profile in pairs:
        source = profile_text(profile)
        positions.append((remember(source), remember(activity_text(activity))) if source else None)
    if not texts:
        return rules, matching_metadata('not_applicable')
    try:
        threshold = float(settings.MATCHING_AI_MIN_SIMILARITY)
        if not math.isfinite(threshold) or not 0 <= threshold < 1:
            raise EmbeddingUnavailable('invalid_configuration')
        if len(texts) > settings.MATCHING_AI_MAX_TEXTS:
            raise EmbeddingUnavailable('input_limit')
        vectors = embed_texts(texts)
        if len(vectors) != len(texts):
            raise EmbeddingUnavailable('invalid_vectors')
        vectors = [_unit_vector(vector) for vector in vectors]
        matches = []
        for baseline, position in zip(rules, positions):
            components = {key: round(value * .7, 2) for key, value in baseline['components'].items()}
            semantic = None
            reason = 'Chưa có kỹ năng hoặc sở thích để so sánh nội dung bằng AI.'
            points = 0
            if position:
                left, right = position
                cosine = max(-1, min(1, math.fsum(a * b for a, b in zip(vectors[left], vectors[right]))))
                points = round(30 * max(0, (cosine - threshold) / (1 - threshold)), 2)
                similarity = round(max(0, cosine) * 100, 1)
                semantic = {'similarity': similarity, 'cosine': round(cosine, 6), 'score': points}
                reason = f'Tương đồng nội dung bằng AI: {similarity}%, quy đổi {points}/30 điểm.'
            components['semantic'] = points
            matches.append({**baseline, 'rule_score': baseline['score'], 'semantic': semantic,
                            'components': components, 'score': min(100, round(sum(components.values()), 2)),
                            'reasons': [*baseline['reasons'], reason]})
        return matches, matching_metadata('active')
    except EmbeddingUnavailable as problem:
        reason = problem.reason if problem.reason in AI_FAILURE_CODES else 'inference_failed'
        return rules, matching_metadata('fallback', reason)
    except Exception:
        # Do not return provider exceptions, local paths or input text to clients.
        return rules, matching_metadata('fallback', 'inference_failed')


def normalized(value):
    value = unicodedata.normalize('NFD', value.casefold().replace('đ', 'd'))
    return ' '.join(re.findall(r'[a-z0-9]+', ''.join(c for c in value if not unicodedata.combining(c))))


def availability_ratio(activity, slots):
    if not slots:
        return None
    # Integrate a weekly repeating schedule in constant time per slot, including
    # cross-midnight and multi-week activities, without iterating every day.
    ranges = [(slot.weekday * 86400 + slot.starts_at.hour * 3600 + slot.starts_at.minute * 60,
               slot.weekday * 86400 + slot.ends_at.hour * 3600 + slot.ends_at.minute * 60) for slot in slots]
    def covered_until(instant):
        weeks, remainder = divmod((instant.astimezone(ZONE) - ANCHOR).total_seconds(), WEEK)
        return sum(weeks * (end - start) + max(0, min(remainder, end) - start) for start, end in ranges)
    duration = (activity.ends_at - activity.starts_at).total_seconds()
    return max(0, min(1, (covered_until(activity.ends_at) - covered_until(activity.starts_at)) / duration)) if duration > 0 else 0


def evaluate(activity, profile):
    required = list(activity.required_skills.all())
    skills = {skill.pk for skill in profile.skills.all()} if profile else set()
    matched = [skill.name for skill in required if skill.pk in skills]
    text = f' {normalized(activity.title + " " + activity.description)} '
    interests = [item for item in (profile.interests if profile else []) if normalized(item) and f' {normalized(item)} ' in text]
    availability = availability_ratio(activity, list(profile.availability.all()) if profile else [])
    components = {'skills': round(50 * len(matched) / len(required), 2) if required else 0,
                  'interests': 20 if interests else 0, 'availability': round(30 * (availability or 0), 2)}
    reasons = [f'Khớp {len(matched)}/{len(required)} kỹ năng yêu cầu.' if required else 'Hoạt động chưa yêu cầu kỹ năng cụ thể.',
               'Sở thích xuất hiện trong tên hoặc mô tả: ' + ', '.join(interests) + '.' if interests else 'Chưa có sở thích trùng cụm từ trong tên hoặc mô tả.',
               'Chưa khai báo lịch rảnh.' if availability is None else f'Lịch rảnh bao phủ {round(availability * 100, 1)}% thời gian hoạt động.']
    return {'score': round(sum(components.values()), 2), 'components': components, 'reasons': reasons,
            'matched_skills': matched, 'matched_interests': interests,
            'availability_percent': None if availability is None else round(availability * 100, 1)}


def available_activities():
    entries = Activity.objects.filter(status='published', published_at__isnull=False, organizer__is_active=True)
    if enabled():
        entries = entries.filter(starts_at__gt=timezone.now())
    return entries.select_related('organizer', 'organizer__organizer_profile').prefetch_related('required_skills', 'timeline').annotate(
        matching_approved=Count('participations', filter=Q(participations__status='approved')))


def conflicts(activity, entries):
    if not enabled():
        return False
    return any(entry.activity_id != activity.pk and entry.activity.starts_at < activity.ends_at
               and entry.activity.ends_at > activity.starts_at for entry in entries)


def ranked_response(request, results, note='', metadata=None):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(results, request)
    response = paginator.get_paginated_response(page)
    response.data.update(note=note, **(metadata or matching_metadata('not_applicable')))
    return response


@method_decorator(never_cache, name='dispatch')
class RecommendedActivities(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def get(self, request):
        profile = VolunteerProfile.objects.filter(user=request.user).prefetch_related('skills', 'availability').first()
        entries = list(Participation.objects.filter(volunteer=request.user).select_related('activity'))
        excluded = {entry.activity_id for entry in entries if entry.status in ['pending', 'approved', 'rejected']}
        approved = [entry for entry in entries if entry.status == 'approved' and entry.activity.status == 'published']
        candidates = []
        for activity in available_activities().exclude(pk__in=excluded):
            if activity.matching_approved >= activity.capacity or conflicts(activity, approved):
                continue
            candidates.append(activity)
        matches, metadata = rank_matches([(activity, profile) for activity in candidates])
        results = []
        for activity, match in zip(candidates, matches):
            if match['score'] > 0:
                results.append({'activity': ActivitySerializer(activity).data, **match})
        results.sort(key=lambda row: (-row['score'], row['activity']['starts_at'], row['activity']['id']))
        return ranked_response(request, results, 'Bổ sung kỹ năng, sở thích và lịch rảnh trong hồ sơ để cải thiện gợi ý. Không tự đăng ký hoạt động.', metadata)


@method_decorator(never_cache, name='dispatch')
class RecommendedVolunteers(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, pk):
        activity = get_object_or_404(Activity.objects.prefetch_related('required_skills'), pk=pk, organizer=request.user)
        if activity.status != 'published' or not activity.published_at or (enabled() and activity.starts_at <= timezone.now()):
            return ranked_response(request, [], 'Chỉ gợi ý người tham gia cho hoạt động Công khai chưa bắt đầu.')
        if activity.participations.filter(status='approved').count() >= activity.capacity:
            return ranked_response(request, [], 'Hoạt động đã đủ số người được duyệt.')
        excluded = activity.participations.filter(status__in=['pending', 'approved', 'rejected']).values_list('volunteer_id', flat=True)
        approved = Participation.objects.filter(status='approved', activity__status='published',
            activity__starts_at__lt=activity.ends_at, activity__ends_at__gt=activity.starts_at).select_related('activity')
        profiles = VolunteerProfile.objects.filter(matching_visible=True, user__role='volunteer', user__is_active=True).exclude(user_id__in=excluded).select_related('user').prefetch_related(
            'skills', 'availability', Prefetch('user__participations', queryset=approved, to_attr='matching_approved_entries'))
        invitation_statuses = dict(Invitation.objects.filter(activity=activity).values_list('volunteer_id', 'status'))
        candidates = []
        for profile in profiles:
            if conflicts(activity, profile.user.matching_approved_entries):
                continue
            candidates.append(profile)
        matches, metadata = rank_matches([(activity, profile) for profile in candidates])
        results = []
        for profile, match in zip(candidates, matches):
            if match['score'] > 0:
                results.append({'volunteer': {'id': str(profile.user_id), 'full_name': profile.user.full_name},
                                'invitation_status': invitation_statuses.get(profile.user_id), **match})
        results.sort(key=lambda row: (-row['score'], row['volunteer']['full_name'].casefold(), row['volunteer']['id']))
        return ranked_response(request, results, 'Chỉ gồm người đã bật cho phép xuất hiện trong gợi ý. Bạn có thể gửi lời mời; khi người nhận chấp nhận trước giờ bắt đầu và còn chỗ, đăng ký sẽ được tự động duyệt.', metadata)
