from datetime import datetime, time, timedelta, timezone as datetime_timezone
from zoneinfo import ZoneInfo

from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.db.models import Case, Count, IntegerField, Min, Prefetch, Q, Sum, When
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.activities import time_policy
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

    def search_queryset(self, queryset):
        term = self.request.query_params.get('search', '').strip()
        if len(term) > 200:
            raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})
        return queryset.filter(activity__title__icontains=term) if term else queryset

    def filter_before_summary(self, queryset):
        self.list_status = self.request.query_params.get('status', 'all').strip()
        if self.list_status not in ['all', *Participation.Status.values]:
            raise ValidationError({'status': 'Trạng thái đơn đăng ký không hợp lệ.'})
        return self.search_queryset(queryset)

    def filter_after_summary(self, queryset):
        return queryset.filter(status=self.list_status) if self.list_status != 'all' else queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_before_summary(self.filter_queryset(self.get_queryset()))
        summary = self.get_summary(queryset)
        queryset = self.filter_after_summary(queryset)
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
        now = timezone.now()
        unattended = Q(attendance__isnull=True)
        self.check_in_states = {
            'attended': Q(attendance__isnull=False),
            'open': unattended,
            'upcoming': Q(pk__in=[]),
            'closed': Q(pk__in=[]),
        }
        if time_policy.enabled():
            self.check_in_states.update({
                'open': unattended & Q(activity__starts_at__lte=now, activity__ends_at__gte=now),
                'upcoming': unattended & Q(activity__starts_at__gt=now),
                'closed': unattended & Q(activity__ends_at__lt=now),
            })
        return super().get_queryset().filter(
            status='approved', activity__status='published', activity__published_at__isnull=False,
        ).annotate(
            check_in_priority=Case(
                *[When(self.check_in_states[state], then=index)
                  for index, state in enumerate(['open', 'upcoming', 'attended', 'closed'])],
                default=3, output_field=IntegerField(),
            ),
        ).order_by('check_in_priority', 'activity__starts_at', 'id')

    def filter_before_summary(self, queryset):
        self.list_status = self.request.query_params.get('status', 'all').strip()
        if self.list_status not in ['all', *self.check_in_states]:
            raise ValidationError({'status': 'Trạng thái điểm danh không hợp lệ.'})
        return self.search_queryset(queryset)

    def filter_after_summary(self, queryset):
        return queryset.filter(self.check_in_states[self.list_status]) if self.list_status != 'all' else queryset

    def get_summary(self, queryset):
        summary = queryset.aggregate(
            total=Count('pk'),
            attended=Count('pk', filter=Q(attendance__isnull=False)),
            pending=Count('pk', filter=Q(attendance__isnull=True)),
            open=Count('pk', filter=self.check_in_states['open']),
            upcoming=Count('pk', filter=self.check_in_states['upcoming']),
            closed=Count('pk', filter=self.check_in_states['closed']),
            next_start=Min('activity__starts_at', filter=self.check_in_states['upcoming']),
            next_end=Min('activity__ends_at', filter=self.check_in_states['open']),
        )
        start, end = summary.pop('next_start'), summary.pop('next_end')
        boundaries = [value for value in [start, end + timedelta(milliseconds=1) if end else None] if value]
        # Compute across the searched list, before status filters and pagination.
        # An empty "open" page must still refresh when an upcoming activity starts.
        self.next_transition_at = min(boundaries) if time_policy.enabled() and boundaries else None
        return summary

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data['next_transition_at'] = self.next_transition_at.isoformat() if self.next_transition_at else None
        return response


class MyHistory(MyList):
    def get_queryset(self):
        return super().get_queryset().filter(attendance__isnull=False).order_by('-attendance__confirmed_at', '-id')

    def filter_before_summary(self, queryset):
        self.feedback_status = self.request.query_params.get('feedback', 'all').strip()
        if self.feedback_status not in ['all', 'pending', 'submitted']:
            raise ValidationError({'feedback': 'Trạng thái phản hồi không hợp lệ.'})
        dates = {}
        for key in ['date_from', 'date_to']:
            value = self.request.query_params.get(key, '').strip()
            if not value:
                continue
            try:
                parsed = parse_date(value) if len(value) == 10 else None
            except ValueError:
                parsed = None
            if parsed is None:
                raise ValidationError({key: 'Ngày không hợp lệ. Hãy nhập theo định dạng YYYY-MM-DD.'})
            dates[key] = parsed
        if dates.get('date_from') and dates.get('date_to') and dates['date_from'] > dates['date_to']:
            raise ValidationError({'date_to': 'Ngày kết thúc không được trước ngày bắt đầu.'})
        vn_timezone = ZoneInfo('Asia/Ho_Chi_Minh')
        for key, edge, lookup in [('date_from', time.min, 'gte'), ('date_to', time.max, 'lte')]:
            if key not in dates:
                continue
            try:
                boundary = datetime.combine(dates[key], edge, vn_timezone).astimezone(datetime_timezone.utc)
            except OverflowError:
                raise ValidationError({key: 'Ngày nằm ngoài khoảng thời gian được hỗ trợ.'})
            queryset = queryset.filter(**{f'attendance__confirmed_at__{lookup}': boundary})
        return self.search_queryset(queryset)

    def filter_after_summary(self, queryset):
        if self.feedback_status == 'all':
            return queryset
        return queryset.filter(attendance__feedback__isnull=self.feedback_status == 'pending')

    def get_summary(self, queryset):
        summary = queryset.aggregate(
            total=Count('pk'),
            completed=Count('pk', filter=Q(activity__status='completed')),
            total_score=Sum('attendance__contribution__score', default=0),
            feedback_count=Count('attendance__feedback'),
            confirmed=Count('attendance__contribution'),
            pending=Count('pk', filter=Q(attendance__contribution__isnull=True)),
            feedback_pending=Count('pk', filter=Q(attendance__feedback__isnull=True)),
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
        activities = Activity.objects.select_related('organizer__organizer_profile').annotate(
            matching_approved=Count('participations', filter=Q(participations__status='approved')),
        ).prefetch_related('required_skills', 'timeline')
        activity = get_object_or_404(activities, pk=self.kwargs['pk'], organizer=self.request.user)
        self.applicant_status = self.request.query_params.get('status', 'all').strip()
        if self.applicant_status not in ['all', *Participation.Status.values]:
            raise ValidationError({'status': 'Trạng thái đơn đăng ký không hợp lệ.'})
        term = self.request.query_params.get('search', '').strip()
        if len(term) > 200:
            raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})

        # The reverse relation reuses the loaded activity, including its prefetched details.
        queryset = activity.participations.select_related('volunteer', 'attendance__confirmed_by')
        if term:
            queryset = queryset.filter(Q(volunteer__full_name__icontains=term) | Q(volunteer__email__icontains=term))
        return queryset.order_by(
            Case(When(status='pending', then=0), default=1, output_field=IntegerField()),
            'registered_at', 'pk',
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = queryset.aggregate(
            total=Count('pk'),
            pending=Count('pk', filter=Q(status='pending')),
            approved=Count('pk', filter=Q(status='approved')),
            rejected=Count('pk', filter=Q(status='rejected')),
            cancelled=Count('pk', filter=Q(status='cancelled')),
        )
        if self.applicant_status != 'all':
            queryset = queryset.filter(status=self.applicant_status)
        page = self.paginate_queryset(queryset)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        else:
            results = self.get_serializer(queryset, many=True).data
            response = Response({'count': len(results), 'next': None, 'previous': None, 'results': results})
        response.data['summary'] = summary
        return response


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
        self.attendance_status = self.request.query_params.get('status', 'all').strip()
        if self.attendance_status not in ['all', 'pending', 'attended']:
            raise ValidationError({'status': 'Trạng thái điểm danh không hợp lệ.'})
        term = self.request.query_params.get('search', '').strip()
        if len(term) > 200:
            raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})
        # Preserve evidence if an activity was cancelled after someone attended.
        queryset = entries().filter(activity=activity).filter(Q(status='approved') | Q(attendance__isnull=False))
        if term:
            queryset = queryset.filter(Q(volunteer__full_name__icontains=term) | Q(volunteer__email__icontains=term))
        return queryset.order_by('volunteer__full_name', 'pk')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = queryset.aggregate(
            total=Count('pk'),
            attended=Count('pk', filter=Q(attendance__isnull=False)),
            pending=Count('pk', filter=Q(attendance__isnull=True)),
        )
        if self.attendance_status != 'all':
            queryset = queryset.filter(attendance__isnull=self.attendance_status == 'pending')
        page = self.paginate_queryset(queryset)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        else:
            results = self.get_serializer(queryset, many=True).data
            response = Response({'count': len(results), 'next': None, 'previous': None, 'results': results})
        response.data['summary'] = summary
        return response


@method_decorator(never_cache, name='dispatch')
class ConfirmAttendance(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk, entry_id):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attendance, created = services.confirm_attendance(pk, entry_id, request.user)
        return Response(AttendanceSerializer(attendance).data, status=201 if created else 200)
