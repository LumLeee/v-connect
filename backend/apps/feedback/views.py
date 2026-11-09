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
from apps.activities.time_policy import ended
from apps.activities.views import IsOrganizer
from apps.participations.models import Attendance
from apps.participations.views import IsVolunteer
from . import services
from .serializers import AdminFeedbackFilterSerializer, AdminFeedbackSerializer, FeedbackSerializer, HideSerializer, OwnFeedbackSerializer, SubmitSerializer


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
        eligible = not entry and attended and activity.status == 'completed' and ended(activity)
        context = {'id': str(activity.pk), 'title': activity.title, 'starts_at': activity.starts_at,
                   'address': activity.address, 'status': activity.status} if attended or entry else None
        return Response({'feedback': OwnFeedbackSerializer(entry).data if entry else None,
                         'can_submit': bool(eligible), 'activity': context})

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
        self.activity_feedback = services.visible_feedback().filter(attendance__participation__activity=activity)
        rating = self.request.query_params.get('rating', 'all')
        ordering = self.request.query_params.get('ordering', 'newest')
        if rating not in ['all', '1', '2', '3', '4', '5']:
            raise ValidationError({'rating': 'Chọn all hoặc số sao từ 1 đến 5.'})
        if ordering not in ['newest', 'oldest']:
            raise ValidationError({'ordering': 'Chọn newest hoặc oldest.'})
        queryset = self.activity_feedback if rating == 'all' else self.activity_feedback.filter(rating=int(rating))
        return queryset.order_by('-created_at', '-id') if ordering == 'newest' else queryset.order_by('created_at', 'id')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        response = self.get_paginated_response(self.get_serializer(self.paginate_queryset(queryset), many=True).data)
        # Keep the overall activity score stable when selecting a star filter.
        response.data['summary'] = services.summary(self.activity_feedback)
        return response


@method_decorator(never_cache, name='dispatch')
class AdminFeedback(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminFeedbackSerializer

    def get_queryset(self):
        serializer = AdminFeedbackFilterSerializer(data={
            key: self.request.query_params[key] for key in ('status', 'activity') if key in self.request.query_params
        })
        serializer.is_valid(raise_exception=True)
        return services.admin_feedback(serializer.validated_data)


@method_decorator(never_cache, name='dispatch')
class HideFeedback(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        serializer = HideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(AdminFeedbackSerializer(services.hide(pk, request.user, serializer.validated_data['reason'])).data)
