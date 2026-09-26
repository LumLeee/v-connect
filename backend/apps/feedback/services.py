from django.db import transaction
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.models import Activity
from apps.reports.models import AuditEvent
from apps.participations.models import Attendance
from .models import Feedback


def feedback_entries():
    return Feedback.objects.select_related('attendance__participation__activity', 'attendance__participation__volunteer', 'hidden_by')


def visible_feedback():
    # Use this queryset for both the organizer list and its rating statistics.
    return feedback_entries().filter(is_hidden=False, attendance__participation__status='approved',
                                     attendance__participation__activity__status='completed')


def summary(queryset):
    result = queryset.aggregate(count=Count('id'), average_rating=Avg('rating'))
    if result['average_rating'] is not None:
        result['average_rating'] = round(result['average_rating'], 2)
    return result


@transaction.atomic
def submit(activity_id, volunteer, data):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, published_at__isnull=False)
    if activity.status != 'completed' or activity.ends_at > timezone.now():
        raise ValidationError('Chỉ gửi phản hồi sau khi hoạt động đã kết thúc và được đánh dấu Hoàn thành.')
    attendance = Attendance.objects.filter(participation__activity=activity, participation__volunteer=volunteer,
                                            participation__status='approved').first()
    if attendance is None:
        raise ValidationError('Bạn cần được xác nhận có mặt để gửi phản hồi cho hoạt động này.')
    if Feedback.objects.filter(attendance=attendance).exists():
        raise ValidationError('Bạn đã gửi phản hồi cho hoạt động này; không thể gửi thêm hoặc sửa lại.')
    return Feedback.objects.create(attendance=attendance, **data)


@transaction.atomic
def hide(feedback_id, admin, reason):
    entry = get_object_or_404(Feedback.objects.select_for_update(), pk=feedback_id)
    # Preserve the first moderation decision when retrying a request.
    if not entry.is_hidden:
        entry.is_hidden = True
        entry.hidden_by = admin
        entry.hidden_at = timezone.now()
        entry.hidden_reason = reason
        entry.save(update_fields=['is_hidden', 'hidden_by', 'hidden_at', 'hidden_reason'])
        AuditEvent.objects.create(actor=admin, subject=entry.attendance.participation.volunteer,
            activity=entry.attendance.participation.activity, object_id=entry.pk, action='feedback_hidden', reason=reason)
    return entry
