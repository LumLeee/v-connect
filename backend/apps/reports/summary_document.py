import hashlib
import json

from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.serializers import ActivitySerializer
from apps.activities.time_policy import ended
from apps.participations.models import Attendance, Contribution
from .views import IsManager
from .services import activities_for, metrics_for


def summary_fingerprint(data):
    """Identify the factual snapshot, excluding request time and reader identity."""
    facts = {key: data[key] for key in ('activity', 'metrics', 'contributions')}
    return hashlib.sha256(json.dumps(facts, sort_keys=True, ensure_ascii=False, default=str).encode('utf-8')).hexdigest()


def summary_data(user, pk):
    activity = get_object_or_404(activities_for(user).prefetch_related('timeline', 'required_skills'), pk=pk)
    if activity.status != 'completed' or not ended(activity):
        raise ValidationError('Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành và đã kết thúc.')
    attendance = Attendance.objects.filter(participation__activity=activity, participation__status='approved')
    contributions = Contribution.objects.filter(attendance__in=attendance)
    totals = contributions.aggregate(score=Sum('score'), confirmed=Count('pk'))
    data = {
        'activity': ActivitySerializer(activity).data, 'metrics': metrics_for(user, activity),
        'contributions': {'score': totals['score'] or 0, 'confirmed': totals['confirmed'],
                          'pending': attendance.count() - totals['confirmed']},
        'generated_at': timezone.now(), 'prepared_by': user.full_name,
    }
    data['source_fingerprint'] = summary_fingerprint(data)
    return data


@method_decorator(never_cache, name='dispatch')
class ActivitySummaryDocument(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request, pk):
        return Response(summary_data(request.user, pk))
