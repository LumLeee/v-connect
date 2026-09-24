import uuid

from django.conf import settings
from django.db import models


class Activity(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        PUBLISHED = 'published', 'Công khai'
        COMPLETED = 'completed', 'Hoàn thành'
        CANCELLED = 'cancelled', 'Đã hủy'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organizer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='activities')
    title = models.CharField('Tên hoạt động', max_length=200)
    description = models.TextField('Mô tả', max_length=10000)
    address = models.CharField('Địa chỉ', max_length=500)
    starts_at = models.DateTimeField('Bắt đầu')
    ends_at = models.DateTimeField('Kết thúc')
    capacity = models.PositiveIntegerField('Sức chứa')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['organizer', 'status']), models.Index(fields=['status', 'starts_at'])]
        constraints = [
            models.CheckConstraint(condition=models.Q(ends_at__gt=models.F('starts_at')), name='activity_valid_dates'),
            models.CheckConstraint(condition=models.Q(capacity__gte=1, capacity__lte=100000), name='activity_valid_capacity'),
            models.CheckConstraint(condition=models.Q(status__in=['draft', 'published', 'completed', 'cancelled']), name='activity_valid_status'),
        ]

    def __str__(self):
        return self.title
