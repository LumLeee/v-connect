import uuid

from django.conf import settings
from django.db import models


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

    class Meta:
        ordering = ['-confirmed_at', '-id']
