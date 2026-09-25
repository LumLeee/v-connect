import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Feedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.OneToOneField('participations.Attendance', on_delete=models.PROTECT, related_name='feedback')
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    content = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    is_hidden = models.BooleanField(default=False)
    hidden_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='hidden_feedback')
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_reason = models.CharField(max_length=1000, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5), name='feedback_rating_range'),
            models.CheckConstraint(condition=~models.Q(content=''), name='feedback_content_not_empty'),
            models.CheckConstraint(condition=(
                models.Q(is_hidden=False, hidden_by__isnull=True, hidden_at__isnull=True, hidden_reason='')
                | (models.Q(is_hidden=True, hidden_by__isnull=False, hidden_at__isnull=False) & ~models.Q(hidden_reason=''))
            ), name='feedback_hidden_audit_required'),
        ]
