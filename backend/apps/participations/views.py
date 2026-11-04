from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.db.models import Count, Prefetch, Q, Sum
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.activities.views import IsOrganizer
from .models import Participation
from .serializers import ApplicantDetailSerializer, ApplicantSerializer, AttendanceSerializer, EmptySerializer, MyParticipationSerializer, ParticipationSerializer, ReviewSerializer
from . import services


class IsVolunteer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'volunteer'


def entries():
    return Participation.objects.select_related('activity', 'activity__organizer', 'activity__organizer__organizer_profile', 'volunteer', 'attendance__confirmed_by')


@method_decorator(never_cache, name='dispatch')
class MyList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsVolunteer]
    serializer_class = MyParticipationSerializer

    def get_queryset(self):
        activities = Activity.objects.select_related('organizer__organizer_profile').annotate(
            matching_approved=Count('participations', filter=Q(participations__status='approved')),
        ).prefetch_related('required_skills', 'timeline')
        return Participation.objects.filter(volunteer=self.request.user).select_related(
            'attendance__confirmed_by', 'attendance__contribution__confirmed_by', 'attendance__feedback',
        ).prefetch_related(Prefetch('activity', queryset=activities))

    def get_summary(self, queryset):
        return queryset.aggregate(
            total=Count('pk'),
            pending=Count('pk', filter=Q(status='pending')),
            approved=Count('pk', filter=Q(status='approved')),
            rejected=Count('pk', filter=Q(status='rejected')),
            cancelled=Count('pk', filter=Q(status='cancelled')),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = self.get_summary(queryset)
        page = self.paginate_queryset(queryset)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        else:
            results = self.get_serializer(queryset, many=True).data
            response = Response({'count': len(results), 'next': None, 'previous': None, 'results': results})
        response.data['summary'] = summary
        return response


class MyCheckIn(MyList):
    def get_queryset(self):
        return super().get_queryset().filter(
            status='approved', activity__status='published', activity__published_at__isnull=False,
        ).order_by('activity__starts_at', 'id')

    def get_summary(self, queryset):
        return queryset.aggregate(
            total=Count('pk'),
            attended=Count('pk', filter=Q(attendance__isnull=False)),
            pending=Count('pk', filter=Q(attendance__isnull=True)),
        )


class MyHistory(MyList):
    def get_queryset(self):
        return super().get_queryset().filter(attendance__isnull=False).order_by('-attendance__confirmed_at', '-id')

    def get_summary(self, queryset):
        summary = queryset.aggregate(
            total=Count('pk'),
            completed=Count('pk', filter=Q(activity__status='completed')),
            total_score=Sum('attendance__contribution__score', default=0),
            feedback_count=Count('attendance__feedback'),
            confirmed=Count('attendance__contribution'),
            pending=Count('pk', filter=Q(attendance__contribution__isnull=True)),
        )
        return summary


@method_decorator(never_cache, name='dispatch')
class MyParticipation(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def get(self, request, pk):
        get_object_or_404(Activity, pk=pk, published_at__isnull=False)
        entry = entries().filter(activity_id=pk, volunteer=request.user).first()
        return Response({'participation': ParticipationSerializer(entry).data if entry else None})

    def post(self, request, pk):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = services.register(pk, request.user)
        return Response({'participation': ParticipationSerializer(entry).data}, status=201)


@method_decorator(never_cache, name='dispatch')
class CancelParticipation(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def post(self, request, pk):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({'participation': ParticipationSerializer(services.cancel(pk, request.user)).data})


@method_decorator(never_cache, name='dispatch')
class ApplicantList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = ApplicantSerializer

    def get_queryset(self):
        activity = get_object_or_404(Activity, pk=self.kwargs['pk'], organizer=self.request.user)
        return entries().filter(activity=activity)


@method_decorator(never_cache, name='dispatch')
class ApplicantDetail(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = ApplicantDetailSerializer
    lookup_url_kwarg = 'entry_id'

    def get_queryset(self):
        return entries().filter(activity_id=self.kwargs['pk'], activity__organizer=self.request.user).select_related('volunteer__volunteer_profile')


class ApplicantAvatar(ApplicantDetail):
    def get(self, request, *args, **kwargs):
        entry = self.get_object()
        if not entry.volunteer.avatar:
            raise Http404
        try:
            stream = entry.volunteer.avatar.open('rb')
        except FileNotFoundError as exc:
            raise Http404 from exc
        return FileResponse(stream, content_type='image/jpeg')


@method_decorator(never_cache, name='dispatch')
class ReviewParticipation(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk, entry_id):
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = services.review(pk, entry_id, request.user, serializer.validated_data['status'])
        return Response(ApplicantSerializer(entry).data)


@method_decorator(never_cache, name='dispatch')
class AttendanceList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = ApplicantSerializer

    def get_queryset(self):
        activity = get_object_or_404(Activity, pk=self.kwargs['pk'], organizer=self.request.user)
        # Preserve evidence if an activity was cancelled after someone attended.
        return entries().filter(activity=activity).filter(Q(status='approved') | Q(attendance__isnull=False))


@method_decorator(never_cache, name='dispatch')
class ConfirmAttendance(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk, entry_id):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attendance, created = services.confirm_attendance(pk, entry_id, request.user)
        return Response(AttendanceSerializer(attendance).data, status=201 if created else 200)
