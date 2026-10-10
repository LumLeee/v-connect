from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.activities.models import Activity
from apps.activities.views import IsOrganizer
from apps.notifications.services import notify
from apps.reports.models import AuditEvent
from .models import Attendance, Contribution, ContributionChange
from .views import IsVolunteer


def max_minutes(activity):
    return max(0, int((activity.ends_at - activity.starts_at).total_seconds() // 60))


class ChangeSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.full_name')

    class Meta:
        model = ContributionChange
        fields = ['revision', 'previous_minutes', 'minutes', 'reason', 'actor_name', 'created_at']


class ContributionSerializer(serializers.ModelSerializer):
    confirmed_by_name = serializers.CharField(source='confirmed_by.full_name')

    class Meta:
        model = Contribution
        fields = ['minutes', 'revision', 'confirmed_by_name', 'updated_at']


class EntrySerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source='participation.volunteer.full_name')
    activity = serializers.SerializerMethodField()
    contribution = ContributionSerializer(read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'confirmed_at', 'volunteer_name', 'activity', 'contribution']

    def get_activity(self, attendance):
        activity = attendance.participation.activity
        return dict(id=str(activity.pk), title=activity.title, starts_at=activity.starts_at,
                    status=activity.status, max_minutes=max_minutes(activity), organizer_name=activity.organizer.full_name)


def eligible_entries():
    return Attendance.objects.filter(participation__status='approved', participation__activity__status='completed',
        participation__activity__ends_at__lte=timezone.now()).select_related('participation__volunteer',
        'participation__activity__organizer', 'contribution__confirmed_by')


class ConfirmSerializer(StrictFieldsMixin, serializers.Serializer):
    minutes = serializers.IntegerField(min_value=0, max_value=2147483647)
    revision = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')


@transaction.atomic
def confirm(actor, activity_id, attendance_id, values):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=actor)
    if activity.status != 'completed' or activity.ends_at > timezone.now():
        raise ValidationError('Chỉ xác nhận đóng góp sau khi hoạt động Hoàn thành và đã kết thúc.')
    attendance = get_object_or_404(Attendance.objects.select_related('participation__volunteer'),
        pk=attendance_id, participation__activity=activity, participation__status='approved')
    if values['minutes'] > max_minutes(activity):
        raise ValidationError({'minutes': f'Số phút không được vượt thời lượng hoạt động ({max_minutes(activity)} phút).'})
    record = Contribution.objects.filter(attendance=attendance).first()
    revision = record.revision if record else 0
    if values['revision'] != revision:
        raise ValidationError('Số giờ đã được cập nhật. Hãy tải lại danh sách trước khi xác nhận.')
    if record and record.minutes == values['minutes']:
        return record
    if record and not values['reason'].strip():
        raise ValidationError({'reason': 'Nhập lý do khi điều chỉnh số phút đóng góp.'})
    previous = record.minutes if record else None
    if record:
        record.minutes = values['minutes']
        record.revision += 1
        record.confirmed_by = actor
        record.save(update_fields=['minutes', 'revision', 'confirmed_by', 'updated_at'])
    else:
        record = Contribution.objects.create(attendance=attendance, minutes=values['minutes'], confirmed_by=actor)
    ContributionChange.objects.create(contribution=record, revision=record.revision, previous_minutes=previous,
        minutes=record.minutes, reason=values['reason'], actor=actor)
    AuditEvent.objects.create(actor=actor, subject=attendance.participation.volunteer, activity=activity,
        object_id=attendance.pk, action='contribution_confirmed' if previous is None else 'contribution_updated',
        reason=values['reason'], before=None if previous is None else {'minutes': previous, 'revision': revision},
        after={'minutes': record.minutes, 'revision': record.revision})
    notify(attendance.participation.volunteer, 'contribution_confirmed' if previous is None else 'contribution_updated',
        'Đóng góp đã được xác nhận' if previous is None else 'Giờ đóng góp được điều chỉnh',
        f'“{activity.title}”: {record.minutes} phút được công nhận.', activity, href='/tinh-nguyen-vien/dong-gop')
    return record


@method_decorator(never_cache, name='dispatch')
class ManagedContributions(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = EntrySerializer

    def get_queryset(self):
        activity = get_object_or_404(Activity, pk=self.kwargs['pk'], organizer=self.request.user)
        return eligible_entries().filter(participation__activity=activity)


@method_decorator(never_cache, name='dispatch')
class ConfirmContribution(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk, attendance_id):
        serializer = ConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(ContributionSerializer(confirm(request.user, pk, attendance_id, serializer.validated_data)).data)


@method_decorator(never_cache, name='dispatch')
class MyContributions(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsVolunteer]
    serializer_class = EntrySerializer

    def get_queryset(self):
        return eligible_entries().filter(participation__volunteer=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        response = super().list(request, *args, **kwargs)
        response.data['summary'] = {
            'minutes': queryset.aggregate(total=Sum('contribution__minutes'))['total'] or 0,
            'confirmed': queryset.filter(contribution__isnull=False).count(),
            'pending': queryset.filter(contribution__isnull=True).count(),
        }
        return response


@method_decorator(never_cache, name='dispatch')
class ContributionHistory(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangeSerializer

    def get_queryset(self):
        entries = Attendance.objects.all()
        if self.request.user.role == 'volunteer':
            entries = entries.filter(participation__volunteer=self.request.user)
        elif self.request.user.role == 'organizer':
            entries = entries.filter(participation__activity__organizer=self.request.user)
        elif self.request.user.role != 'admin':
            entries = entries.none()
        attendance = get_object_or_404(entries, pk=self.kwargs['attendance_id'])
        return ContributionChange.objects.filter(contribution__attendance=attendance).select_related('actor')
