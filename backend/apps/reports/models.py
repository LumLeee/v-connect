import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='audit_actions')
    action = models.CharField(max_length=40, choices=[
        ('account_locked', 'Khóa tài khoản'), ('account_unlocked', 'Mở khóa tài khoản'),
        ('review_approved', 'Duyệt đăng ký'), ('review_rejected', 'Từ chối đăng ký'),
        ('attendance_confirmed', 'Xác nhận có mặt'), ('feedback_hidden', 'Ẩn phản hồi'),
        ('attendance_code_issued', 'Tạo mã điểm danh'), ('attendance_code_revoked', 'Thu hồi mã điểm danh'),
        ('activity_created', 'Tạo hoạt động'), ('activity_updated', 'Sửa hoạt động'),
        ('activity_status_changed', 'Đổi trạng thái hoạt động'), ('activity_cover_changed', 'Đổi ảnh bìa'),
        ('contribution_confirmed', 'Xác nhận đóng góp'), ('contribution_updated', 'Điều chỉnh đóng góp'),
        ('certificate_issued', 'Cấp chứng nhận'), ('certificate_revoked', 'Thu hồi chứng nhận'),
    ])
    object_id = models.UUIDField()
    activity = models.ForeignKey('activities.Activity', on_delete=models.PROTECT, null=True, blank=True)
    subject = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='audit_subjects', null=True, blank=True)
    reason = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['action', 'created_at']),
                   models.Index(fields=['actor', 'created_at']), models.Index(fields=['subject', 'created_at']),
                   models.Index(fields=['activity', 'created_at'])]


class Certificate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.ForeignKey('participations.Attendance', on_delete=models.PROTECT, related_name='certificates')
    active_attendance = models.OneToOneField('participations.Attendance', on_delete=models.PROTECT, null=True, blank=True, related_name='active_certificate')
    volunteer_name = models.CharField(max_length=255)
    activity_title = models.CharField(max_length=200)
    organization_name = models.CharField(max_length=255)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    minutes = models.PositiveIntegerField()
    contribution_revision = models.PositiveIntegerField()
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='issued_certificates')
    issued_by_name = models.CharField(max_length=255)
    issued_at = models.DateTimeField(default=timezone.now, editable=False)
    revoked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='revoked_certificates')
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=1000, blank=True)

    class Meta:
        ordering = ['-issued_at', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(minutes__gt=0), name='certificate_positive_minutes'),
            models.CheckConstraint(condition=(
                models.Q(revoked_at__isnull=True, revoked_by__isnull=True, revocation_reason='', active_attendance__isnull=False, active_attendance=models.F('attendance')) |
                (models.Q(revoked_at__isnull=False, revoked_by__isnull=False, active_attendance__isnull=True) & ~models.Q(revocation_reason=''))
            ), name='certificate_valid_state'),
        ]
