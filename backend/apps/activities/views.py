from django.db import transaction
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
from .serializers import ActivitySerializer, TransitionSerializer


class IsOrganizer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'organizer'


def activities():
    return Activity.objects.select_related('organizer', 'organizer__organizer_profile')


def search(queryset, request):
    term = request.query_params.get('search', '').strip()
    if len(term) > 200:
        raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})
    return queryset.filter(title__icontains=term) if term else queryset


class PublicList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return search(activities().filter(published_at__isnull=False, status__in=['published', 'completed', 'cancelled']), self.request)


class PublicDetail(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return activities().filter(published_at__isnull=False, status__in=['published', 'completed', 'cancelled'])


@method_decorator(never_cache, name='dispatch')
class ManagedList(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return search(activities().filter(organizer=self.request.user), self.request)

    def perform_create(self, serializer):
        serializer.save(organizer=self.request.user)


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
            if serializer.validated_data.get('capacity', activity.capacity) < activity.participations.filter(status='approved').count():
                raise ValidationError({'capacity': 'Sức chứa không được thấp hơn số người đã được duyệt.'})
            if activity.starts_at <= timezone.now() and activity.participations.exists() and any(
                name in serializer.validated_data and serializer.validated_data[name] != getattr(activity, name)
                for name in ['starts_at', 'ends_at']
            ):
                raise ValidationError('Không thể đổi lịch sau giờ bắt đầu khi đã có đơn đăng ký.')
            serializer.save()
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
                if activity.starts_at <= now:
                    raise ValidationError({'starts_at': 'Cập nhật thời gian bắt đầu ở tương lai trước khi công khai.'})
                activity.published_at = now
            if target == 'completed' and activity.ends_at > now:
                raise ValidationError({'status': 'Chỉ hoàn thành hoạt động sau thời gian kết thúc.'})
            activity.status = target
            activity.save(update_fields=['status', 'published_at', 'updated_at'])
            if target == 'cancelled':
                activity.participations.filter(status__in=['pending', 'approved']).update(
                    status='cancelled', cancellation_reason='activity_cancelled', updated_at=now)
        return Response(ActivitySerializer(activity).data)
