from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.activities.views import IsOrganizer
from apps.participations.models import Attendance
from apps.participations.views import IsVolunteer
from . import services
from .serializers import AdminFeedbackSerializer, FeedbackSerializer, HideSerializer, OwnFeedbackSerializer, SubmitSerializer


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


@method_decorator(never_cache, name='dispatch')
class MyFeedback(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def get(self, request, pk):
        activity = get_object_or_404(Activity, pk=pk, published_at__isnull=False)
        entry = services.feedback_entries().filter(attendance__participation__activity=activity,
            attendance__participation__volunteer=request.user).first()
        attended = Attendance.objects.filter(participation__activity=activity, participation__volunteer=request.user,
                                             participation__status='approved').exists()
        eligible = not entry and attended and activity.status == 'completed' and activity.ends_at <= timezone.now()
        return Response({'feedback': OwnFeedbackSerializer(entry).data if entry else None, 'can_submit': bool(eligible)})

    def post(self, request, pk):
        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(OwnFeedbackSerializer(services.submit(pk, request.user, serializer.validated_data)).data, status=201)


@method_decorator(never_cache, name='dispatch')
class OrganizerFeedback(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        activity = get_object_or_404(Activity, pk=self.kwargs['pk'], organizer=self.request.user)
        return services.visible_feedback().filter(attendance__participation__activity=activity)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        response = self.get_paginated_response(self.get_serializer(self.paginate_queryset(queryset), many=True).data)
        response.data['summary'] = services.summary(queryset)
        return response


@method_decorator(never_cache, name='dispatch')
class AdminFeedback(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminFeedbackSerializer

    def get_queryset(self):
        queryset = services.feedback_entries()
        status = self.request.query_params.get('status', 'all')
        if status not in ['all', 'visible', 'hidden']:
            raise ValidationError({'status': 'Chọn all, visible hoặc hidden.'})
        return queryset if status == 'all' else queryset.filter(is_hidden=status == 'hidden')


@method_decorator(never_cache, name='dispatch')
class HideFeedback(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        serializer = HideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(AdminFeedbackSerializer(services.hide(pk, request.user, serializer.validated_data['reason'])).data)
