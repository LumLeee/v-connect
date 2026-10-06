from django.db.models import Count, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.profile_serializers import ProfileSerializer
from apps.activities.views import IsOrganizer
from . import services


class DashboardActivitySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    address = serializers.CharField()
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    status = serializers.CharField()
    capacity = serializers.IntegerField()
    approved_count = serializers.IntegerField()


class PendingEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    volunteer_name = serializers.CharField(source='volunteer.full_name')
    activity_id = serializers.UUIDField()
    activity_title = serializers.CharField(source='activity.title')
    starts_at = serializers.DateTimeField(source='activity.starts_at')


@method_decorator(never_cache, name='dispatch')
class OrganizerDashboard(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request):
        now = timezone.now()
        activities = services.activities_for(request.user)
        counts = activities.aggregate(total=Count('pk'), completed=Count('pk', filter=Q(status='completed')),
                                      draft=Count('pk', filter=Q(status='draft')))
        preview = activities.annotate(approved_count=Count('participations', filter=Q(participations__status='approved')))
        ongoing = preview.filter(status='published', starts_at__lte=now, ends_at__gte=now).order_by('ends_at', 'id')
        upcoming = preview.filter(status='published', starts_at__gt=now).order_by('starts_at', 'id')
        pending = services.participations_for(request.user).filter(status='pending', activity__status='published',
            activity__starts_at__gt=now).select_related('activity', 'volunteer').order_by('activity__starts_at', 'registered_at', 'id')
        return Response({
            'profile': ProfileSerializer(request.user).data,
            'activity_counts': counts,
            'metrics': services.metrics_for(request.user),
            'ongoing_count': ongoing.count(),
            'ongoing': DashboardActivitySerializer(ongoing[:3], many=True).data,
            'upcoming_count': upcoming.count(),
            'upcoming': DashboardActivitySerializer(upcoming[:4], many=True).data,
            'pending_count': pending.count(),
            'pending': PendingEntrySerializer(pending[:4], many=True).data,
        })
