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
