"""Deterministic, explainable matching; scores are not acceptance probabilities."""
import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import VolunteerProfile
from apps.activities.models import Activity
from apps.activities.serializers import ActivitySerializer
from apps.activities.views import IsOrganizer
from apps.core.pagination import StandardPagination
from apps.participations.models import Participation
from apps.participations.views import IsVolunteer

ZONE = ZoneInfo('Asia/Ho_Chi_Minh')
ANCHOR = datetime(1970, 1, 5, tzinfo=ZONE)
WEEK = 7 * 86400
METHOD = 'rules_v1'


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
    return Activity.objects.filter(status='published', published_at__isnull=False, starts_at__gt=timezone.now(),
        organizer__is_active=True).select_related('organizer', 'organizer__organizer_profile').prefetch_related('required_skills').annotate(
        matching_approved=Count('participations', filter=Q(participations__status='approved')))


def conflicts(activity, entries):
    return any(entry.activity_id != activity.pk and entry.activity.starts_at < activity.ends_at
               and entry.activity.ends_at > activity.starts_at for entry in entries)


def ranked_response(request, results, note=''):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(results, request)
    response = paginator.get_paginated_response(page)
    response.data.update(method=METHOD, note=note,
        explanation='Điểm quy tắc /100: kỹ năng tối đa 50, sở thích 20, lịch rảnh 30. Không phải xác suất được duyệt; chưa dùng AI.')
    return response


@method_decorator(never_cache, name='dispatch')
class RecommendedActivities(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def get(self, request):
        profile = VolunteerProfile.objects.filter(user=request.user).prefetch_related('skills', 'availability').first()
        entries = list(Participation.objects.filter(volunteer=request.user).select_related('activity'))
        excluded = {entry.activity_id for entry in entries if entry.status in ['pending', 'approved', 'rejected']}
        approved = [entry for entry in entries if entry.status == 'approved' and entry.activity.status == 'published']
        results = []
        for activity in available_activities().exclude(pk__in=excluded):
            if activity.matching_approved >= activity.capacity or conflicts(activity, approved):
                continue
            match = evaluate(activity, profile)
            if match['score'] > 0:
                results.append({'activity': ActivitySerializer(activity).data, **match})
        results.sort(key=lambda row: (-row['score'], row['activity']['starts_at'], row['activity']['id']))
        return ranked_response(request, results, 'Bổ sung kỹ năng, sở thích và lịch rảnh trong hồ sơ để cải thiện gợi ý. Không tự đăng ký hoạt động.')


@method_decorator(never_cache, name='dispatch')
class RecommendedVolunteers(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, pk):
        activity = get_object_or_404(Activity.objects.prefetch_related('required_skills'), pk=pk, organizer=request.user)
        if activity.status != 'published' or not activity.published_at or activity.starts_at <= timezone.now():
            return ranked_response(request, [], 'Chỉ gợi ý người tham gia cho hoạt động Công khai chưa bắt đầu.')
        if activity.participations.filter(status='approved').count() >= activity.capacity:
            return ranked_response(request, [], 'Hoạt động đã đủ số người được duyệt.')
        excluded = activity.participations.filter(status__in=['pending', 'approved', 'rejected']).values_list('volunteer_id', flat=True)
        approved = Participation.objects.filter(status='approved', activity__status='published',
            activity__starts_at__lt=activity.ends_at, activity__ends_at__gt=activity.starts_at).select_related('activity')
        profiles = VolunteerProfile.objects.filter(matching_visible=True, user__role='volunteer', user__is_active=True).exclude(user_id__in=excluded).select_related('user').prefetch_related(
            'skills', 'availability', Prefetch('user__participations', queryset=approved, to_attr='matching_approved_entries'))
        results = []
        for profile in profiles:
            if conflicts(activity, profile.user.matching_approved_entries):
                continue
            match = evaluate(activity, profile)
            if match['score'] > 0:
                results.append({'volunteer': {'id': str(profile.user_id), 'full_name': profile.user.full_name}, **match})
        results.sort(key=lambda row: (-row['score'], row['volunteer']['full_name'].casefold(), row['volunteer']['id']))
        return ranked_response(request, results, 'Chỉ gồm người đã bật cho phép xuất hiện trong gợi ý. Gợi ý không tạo lời mời hoặc tự duyệt đăng ký.')
