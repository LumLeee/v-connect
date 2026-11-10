from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Activity
from .time_policy import enabled, ended
from .serializers import ActivitySerializer, ManagedActivityListSerializer, TransitionSerializer
from .filters import filter_activities
from apps.notifications.services import notify_participants
from apps.participations.models import AttendanceCode
from apps.reports.audit import activity_snapshot, record_activity


class IsOrganizer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'organizer'


def activities():
    return Activity.objects.select_related('organizer', 'organizer__organizer_profile').prefetch_related('required_skills', 'timeline')


def search(queryset, request):
    term = request.query_params.get('search', '').strip()
    if len(term) > 200:
        raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})
    return queryset.filter(title__icontains=term) if term else queryset


@method_decorator(never_cache, name='dispatch')
class PublicList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        open_activities = activities().filter(published_at__isnull=False, status='published').annotate(
            matching_approved=Count('participations', filter=Q(participations__status='approved'), distinct=True),
        ).filter(matching_approved__lt=F('capacity'))
        if enabled():
            open_activities = open_activities.filter(starts_at__gt=timezone.now())
        return filter_activities(search(open_activities, self.request), self.request).order_by('starts_at', 'pk')


class PublicDetail(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return activities().filter(published_at__isnull=False, status='published')


@method_decorator(never_cache, name='dispatch')
class ManagedList(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = ManagedActivityListSerializer

    def get_queryset(self):
        eligible_contribution = Q(status='completed', participations__status='approved')
        if enabled():
            eligible_contribution &= Q(ends_at__lte=timezone.now())
        queryset = activities().filter(organizer=self.request.user).annotate(
            matching_approved=Count('participations', filter=Q(participations__status='approved'), distinct=True),
            registration_count=Count('participations', distinct=True),
            pending_count=Count('participations', filter=Q(participations__status='pending'), distinct=True),
            attendance_count=Count('participations__attendance', distinct=True),
            attendance_pending_count=Count('participations',
                filter=Q(participations__status='approved', participations__attendance__isnull=True), distinct=True),
            feedback_count=Count('participations__attendance__feedback',
                filter=Q(participations__attendance__feedback__is_hidden=False,
                         participations__status='approved', status='completed'), distinct=True),
            contribution_count=Count('participations__attendance__contribution', filter=eligible_contribution, distinct=True),
            contribution_pending_count=Count('participations__attendance',
                filter=eligible_contribution & Q(participations__attendance__contribution__isnull=True), distinct=True),
            invitation_count=Count('invitations', distinct=True),
        )
        return filter_activities(search(queryset, self.request), self.request, managed=True).order_by('-created_at', '-pk')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        mode = request.query_params.get('mode')
        if mode and mode not in ['matching', 'attendance', 'contributions', 'feedback']:
            raise ValidationError({'mode': 'Chức năng quản lý không hợp lệ.'})
        summary = None
        if mode:
            summary = queryset.aggregate(
                activities=Count('pk', distinct=True),
                registered=Sum('registration_count', default=0),
                pending=Sum('pending_count', default=0),
                approved=Sum('matching_approved', default=0),
                attended=Sum('attendance_count', default=0),
                attendance_pending=Sum('attendance_pending_count', default=0),
                confirmed=Sum('contribution_count', default=0),
                contribution_pending=Sum('contribution_pending_count', default=0),
                feedback=Sum('feedback_count', default=0),
                invitations=Sum('invitation_count', default=0),
            )
            if mode == 'feedback':
                summary['with_feedback'] = queryset.filter(feedback_count__gt=0).count()
            if mode == 'matching':
                available = queryset.filter(status='published', published_at__isnull=False,
                                            organizer__is_active=True, capacity__gt=F('matching_approved'))
                if enabled():
                    available = available.filter(starts_at__gt=timezone.now())
                summary['remaining_places'] = available.aggregate(total=Sum(F('capacity') - F('matching_approved'), default=0))['total']
        page = self.paginate_queryset(queryset)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        else:
            results = self.get_serializer(queryset, many=True).data
            response = Response({'count': len(results), 'next': None, 'previous': None, 'results': results})
        if summary is not None:
            response.data['summary'] = summary
        return response

    def perform_create(self, serializer):
        with transaction.atomic():
            activity = serializer.save(organizer=self.request.user)
            record_activity(self.request.user, activity, 'activity_created', None, activity_snapshot(activity))


@method_decorator(never_cache, name='dispatch')
class ManagedDetail(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, pk):
        return Response(ActivitySerializer(get_object_or_404(activities(), pk=pk, organizer=request.user)).data)

    def patch(self, request, pk):
        with transaction.atomic():
            activity = get_object_or_404(Activity.objects.select_for_update(), pk=pk, organizer=request.user)
            if activity.status in ['completed', 'cancelled']:
                raise ValidationError('Không thể sửa hoạt động đã hoàn thành hoặc đã hủy.')
            serializer = ActivitySerializer(activity, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            before = activity_snapshot(activity)
            if serializer.validated_data.get('capacity', activity.capacity) < activity.participations.filter(status='approved').count():
                raise ValidationError({'capacity': 'Sức chứa không được thấp hơn số người đã được duyệt.'})
            if enabled() and activity.starts_at <= timezone.now() and activity.participations.exists() and any(
                name in serializer.validated_data and serializer.validated_data[name] != getattr(activity, name)
                for name in ['starts_at', 'ends_at']
            ):
                raise ValidationError('Không thể đổi lịch sau giờ bắt đầu khi đã có đơn đăng ký.')
            changed = any(name in serializer.validated_data and serializer.validated_data[name] != getattr(activity, name)
                          for name in ['starts_at', 'ends_at', 'address'])
            serializer.save()
            record_activity(request.user, activity, 'activity_updated', before, activity_snapshot(activity))
            if changed:
                AttendanceCode.objects.filter(activity=activity, revoked_at__isnull=True).update(revoked_at=timezone.now())
                notify_participants(activity, 'activity_changed', 'Hoạt động thay đổi lịch hoặc địa điểm',
                                    f'“{activity.title}” vừa cập nhật lịch hoặc địa điểm. Hãy xem thông tin mới trước khi tham gia.')
        return Response(serializer.data)


@method_decorator(never_cache, name='dispatch')
class TransitionView(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk):
        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data['status']
        with transaction.atomic():
            activity = get_object_or_404(Activity.objects.select_for_update(), pk=pk, organizer=request.user)
            allowed = {'draft': ['published', 'cancelled'], 'published': ['completed', 'cancelled']}
            if target not in allowed.get(activity.status, []):
                raise ValidationError({'status': 'Không thể chuyển trạng thái hoạt động theo yêu cầu.'})
            now = timezone.now()
            if target == 'published':
                if enabled() and activity.starts_at <= now:
                    raise ValidationError({'starts_at': 'Thời gian bắt đầu phải ở tương lai khi công khai hoạt động.'})
                activity.published_at = now
            if target == 'completed' and not ended(activity):
                raise ValidationError({'status': 'Chỉ hoàn thành hoạt động sau thời gian kết thúc.'})
            before = {'status': activity.status}
            activity.status = target
            activity.save(update_fields=['status', 'published_at', 'updated_at'])
            record_activity(request.user, activity, 'activity_status_changed', before, {'status': target})
            if target == 'cancelled':
                notify_participants(activity, 'activity_cancelled', 'Hoạt động đã bị hủy',
                                    f'Nhà tổ chức đã hủy “{activity.title}”. Đăng ký của bạn được hủy cùng hoạt động.')
                activity.participations.filter(status__in=['pending', 'approved']).update(
                    status='cancelled', cancellation_reason='activity_cancelled', updated_at=now)
        return Response(ActivitySerializer(activity).data)
