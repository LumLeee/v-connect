"""Explicit read-only AI requests over the same scope as the feedback lists."""
import hashlib
import json
from types import SimpleNamespace

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.activities.models import Activity
from apps.activities.views import IsOrganizer
from . import services
from .ai import analyze_feedback_entries
from .views import IsAdmin


class OrganizerAnalysisSerializer(StrictFieldsMixin, serializers.Serializer):
    rating = serializers.ChoiceField(choices=['all', '1', '2', '3', '4', '5'], default='all')
    ordering = serializers.ChoiceField(choices=['newest', 'oldest'], default='newest')


class AdminAnalysisSerializer(StrictFieldsMixin, serializers.Serializer):
    status = serializers.ChoiceField(choices=['all', 'visible', 'hidden'], default='all')


def _state(queryset, filters):
    """Hash the entire scope without loading its full text into process memory."""
    digest = hashlib.sha256(json.dumps(filters, sort_keys=True).encode('utf-8'))
    count = 0
    for row in queryset.order_by('id').values_list('id', 'content', 'rating', 'created_at', 'is_hidden').iterator(chunk_size=200):
        digest.update(json.dumps([str(value) for value in row], ensure_ascii=False,
                                 separators=(',', ':')).encode('utf-8'))
        digest.update(b'\n')
        count += 1
    return count, digest.hexdigest()


def _response(queryset, filters, activity_id=None):
    # Read only text/state fields, never names, contact details or hidden reasons.
    # Hash the complete selected scope, but send a bounded sample to inference.
    try:
        maximum = int(getattr(settings, 'FEEDBACK_AI_MAX_ITEMS', 40))
        if not 1 <= maximum <= 80:
            raise ValueError
    except (TypeError, ValueError):
        maximum = 40
    count, fingerprint = _state(queryset, filters)
    rows = queryset.values_list('id', 'content', 'rating', 'created_at', 'is_hidden')[:maximum]
    entries = [SimpleNamespace(id=pk, content=content, rating=rating, created_at=created_at, is_hidden=hidden)
               for pk, content, rating, created_at, hidden in rows]
    result = analyze_feedback_entries(entries, activity_id=activity_id, filters=filters,
                                      total_count=count, fingerprint=fingerprint)
    # A concurrent hide, new submission or scope change invalidates the result.
    # In particular, never return a quote just hidden while inference was running.
    if _state(queryset, filters) != (count, fingerprint):
        return Response({'detail': 'Phản hồi đã thay đổi. Hãy tải lại và phân tích lại.',
                         'code': 'source_changed'}, status=409)
    return Response(result)


@method_decorator(never_cache, name='dispatch')
class OrganizerFeedbackAI(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_analysis'

    def post(self, request, pk):
        activity = get_object_or_404(Activity, pk=pk, organizer=request.user)
        serializer = OrganizerAnalysisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        filters = dict(serializer.validated_data)
        queryset = services.visible_feedback().filter(attendance__participation__activity=activity)
        if filters['rating'] != 'all':
            queryset = queryset.filter(rating=int(filters['rating']))
        queryset = queryset.order_by('created_at', 'id') if filters['ordering'] == 'oldest' else queryset.order_by('-created_at', '-id')
        return _response(queryset, filters, activity.pk)


@method_decorator(never_cache, name='dispatch')
class AdminFeedbackAI(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_analysis'

    def post(self, request):
        serializer = AdminAnalysisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        filters = dict(serializer.validated_data)
        queryset = services.feedback_entries()
        if filters['status'] != 'all':
            queryset = queryset.filter(is_hidden=filters['status'] == 'hidden')
        return _response(queryset.order_by('-created_at', '-id'), filters)
