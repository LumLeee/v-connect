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
from apps.participations.models import Attendance, Contribution
from .views import IsManager
from .services import activities_for, metrics_for


@method_decorator(never_cache, name='dispatch')
class ActivitySummaryDocument(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request, pk):
        activity = get_object_or_404(activities_for(request.user).prefetch_related('timeline', 'required_skills'), pk=pk)
        if activity.status != 'completed' or activity.ends_at > timezone.now():
            raise ValidationError('Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành và đã kết thúc.')
        attendance = Attendance.objects.filter(participation__activity=activity, participation__status='approved')
        contributions = Contribution.objects.filter(attendance__in=attendance)
        totals = contributions.aggregate(score=Sum('score'), confirmed=Count('pk'))
        return Response({
            'activity': ActivitySerializer(activity).data, 'metrics': metrics_for(request.user, activity),
            'contributions': {'score': totals['score'] or 0, 'confirmed': totals['confirmed'],
                              'pending': attendance.count() - totals['confirmed']},
            'generated_at': timezone.now(), 'prepared_by': request.user.full_name,
        })
