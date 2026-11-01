import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ phản hồi'
        ACCEPTED = 'accepted', 'Đã chấp nhận'
        DECLINED = 'declined', 'Đã từ chối'
        WITHDRAWN = 'withdrawn', 'Đã thu hồi'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey('activities.Activity', on_delete=models.PROTECT, related_name='invitations')
    volunteer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='invitations')
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sent_invitations')
    message = models.CharField(max_length=1000, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    responded_at = models.DateTimeField(null=True, blank=True)
    invited_starts_at = models.DateTimeField()
    invited_ends_at = models.DateTimeField()
    invited_address = models.CharField(max_length=500)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(fields=['activity', 'volunteer'], name='invitation_unique_volunteer'),
            models.CheckConstraint(condition=models.Q(status__in=['pending', 'accepted', 'declined', 'withdrawn']), name='invitation_valid_status'),
            models.CheckConstraint(condition=(models.Q(status='pending', responded_at__isnull=True) |
                (~models.Q(status='pending') & models.Q(responded_at__isnull=False))), name='invitation_response_state'),
        ]


class Participation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ duyệt'
        APPROVED = 'approved', 'Được duyệt'
        REJECTED = 'rejected', 'Bị từ chối'
        CANCELLED = 'cancelled', 'Đã hủy'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey('activities.Activity', on_delete=models.PROTECT, related_name='participations')
    volunteer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='participations')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    cancellation_reason = models.CharField(max_length=30, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='reviewed_participations')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    registered_starts_at = models.DateTimeField()
    registered_ends_at = models.DateTimeField()
    registered_address = models.CharField(max_length=500)

    class Meta:
        ordering = ['-registered_at', '-id']
        constraints = [
            models.UniqueConstraint(fields=['activity', 'volunteer'], name='participation_unique_volunteer'),
            models.CheckConstraint(condition=models.Q(status__in=['pending', 'approved', 'rejected', 'cancelled']), name='participation_valid_status'),
        ]
        indexes = [models.Index(fields=['activity', 'status'])]


class Attendance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participation = models.OneToOneField(Participation, on_delete=models.PROTECT, related_name='attendance')
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='confirmed_attendances')
    confirmed_at = models.DateTimeField(auto_now_add=True)
    method = models.CharField(max_length=10, default='manual', choices=[('manual', 'Thủ công'), ('qr', 'Quét QR'), ('code', 'Nhập mã')])

    class Meta:
        ordering = ['-confirmed_at', '-id']


class AttendanceCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.OneToOneField('activities.Activity', on_delete=models.CASCADE, related_name='attendance_code')
    nonce = models.UUIDField(default=uuid.uuid4)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    issued_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)


class Contribution(models.Model):
    attendance = models.OneToOneField(Attendance, on_delete=models.PROTECT, related_name='contribution')
    score = models.PositiveIntegerField()
    revision = models.PositiveIntegerField(default=1)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-pk']
        constraints = [models.CheckConstraint(condition=models.Q(score__gte=0, score__lte=10), name='contribution_score_range')]


class ContributionChange(models.Model):
    contribution = models.ForeignKey(Contribution, on_delete=models.PROTECT, related_name='changes')
    revision = models.PositiveIntegerField()
    previous_score = models.PositiveIntegerField(null=True)
    score = models.PositiveIntegerField()
    reason = models.CharField(max_length=1000, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-revision']
        constraints = [
            models.UniqueConstraint(fields=['contribution', 'revision'], name='contribution_unique_revision'),
            models.CheckConstraint(condition=models.Q(score__gte=0, score__lte=10), name='contribution_change_score_range'),
            models.CheckConstraint(condition=models.Q(previous_score__isnull=True) | models.Q(previous_score__gte=0, previous_score__lte=10), name='contribution_previous_score_range'),
        ]
