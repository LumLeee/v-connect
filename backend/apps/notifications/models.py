import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    activity = models.ForeignKey('activities.Activity', null=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=40)
    title = models.CharField(max_length=200)
    body = models.TextField()
    href = models.CharField(max_length=300)
    dedupe_key = models.CharField(max_length=200, unique=True, default=uuid.uuid4)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['recipient', 'read_at', 'created_at'])]


class NotificationPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    email_enabled = models.BooleanField(default=True)


class EmailDelivery(models.Model):
    notification = models.OneToOneField(Notification, on_delete=models.CASCADE)
    status = models.CharField(max_length=12, default='pending')
    attempts = models.PositiveSmallIntegerField(default=0)
    available_at = models.DateTimeField(default=timezone.now, db_index=True)
    locked_at = models.DateTimeField(null=True)
    sent_at = models.DateTimeField(null=True)
    last_error = models.CharField(max_length=40, blank=True)
    # Reminder eligibility is rechecked before delivery after edits/cancellation.
    reminder_participation = models.ForeignKey('participations.Participation', null=True, on_delete=models.SET_NULL)
    reminder_starts_at = models.DateTimeField(null=True)
    reminder_reviewed_at = models.DateTimeField(null=True)
