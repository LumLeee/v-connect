from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.models import Activity
from apps.reports.models import AuditEvent
from .models import Attendance, Participation


def require_open(activity):
    if activity.status != 'published' or activity.starts_at <= timezone.now():
        raise ValidationError('Hoạt động không còn mở đăng ký, hủy đăng ký hoặc xét duyệt.')


def require_space(activity):
    if activity.participations.filter(status='approved').count() >= activity.capacity:
        raise ValidationError('Hoạt động đã đủ số lượng người được duyệt.')


@transaction.atomic
def register(activity_id, volunteer):
    # All mutations lock the activity first, including capacity edits/cancellation.
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, published_at__isnull=False)
    require_open(activity)
    entry = Participation.objects.filter(activity=activity, volunteer=volunteer).first()
    if entry and not (entry.status == 'cancelled' and entry.cancellation_reason == 'volunteer'):
        raise ValidationError('Bạn đã đăng ký hoặc bị từ chối; không thể gửi thêm đơn cho hoạt động này.')
    require_space(activity)
    if entry is None:
        entry = Participation(activity=activity, volunteer=volunteer)
    entry.status = 'pending'
    entry.cancellation_reason = ''
    entry.reviewed_by = None
    entry.reviewed_at = None
    entry.registered_at = timezone.now()
    entry.registered_starts_at = activity.starts_at
    entry.registered_ends_at = activity.ends_at
    entry.registered_address = activity.address
    entry.save()
    return entry


@transaction.atomic
def cancel(activity_id, volunteer):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, published_at__isnull=False)
    require_open(activity)
    entry = get_object_or_404(Participation, activity=activity, volunteer=volunteer)
    if entry.status not in ['pending', 'approved']:
        raise ValidationError('Chỉ hủy được đơn chờ duyệt hoặc đã được duyệt.')
    entry.status = 'cancelled'
    entry.cancellation_reason = 'volunteer'
    entry.save(update_fields=['status', 'cancellation_reason', 'updated_at'])
    return entry


@transaction.atomic
def review(activity_id, entry_id, organizer, target):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=organizer)
    require_open(activity)
    entry = get_object_or_404(Participation.objects.select_related('volunteer'), pk=entry_id, activity=activity)
    if target not in ['approved', 'rejected'] or entry.status != 'pending':
        raise ValidationError('Chỉ xét duyệt đơn đang chờ duyệt.')
    if target == 'approved':
        if not entry.volunteer.is_active or entry.volunteer.role != 'volunteer':
            raise ValidationError('Tài khoản tình nguyện viên không còn khả dụng.')
        require_space(activity)
    entry.status = target
    entry.reviewed_by = organizer
    entry.reviewed_at = timezone.now()
    entry.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
    AuditEvent.objects.create(actor=organizer, subject=entry.volunteer, activity=activity, object_id=entry.pk,
                              action='review_approved' if target == 'approved' else 'review_rejected')
    return entry


@transaction.atomic
def confirm_attendance(activity_id, entry_id, organizer):
    # Share the activity lock with cancellation and participation mutations.
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=organizer)
    entry = get_object_or_404(Participation, pk=entry_id, activity=activity)
    now = timezone.now()
    if activity.status != 'published' or not (activity.starts_at <= now <= activity.ends_at):
        raise ValidationError('Chỉ điểm danh từ giờ bắt đầu đến giờ kết thúc khi hoạt động còn công khai.')
    if entry.status != 'approved':
        raise ValidationError('Chỉ điểm danh người đã được duyệt và chưa hủy đăng ký.')
    # An identical retry returns the original record, without changing its audit data.
    attendance, created = Attendance.objects.get_or_create(participation=entry, defaults={'confirmed_by': organizer})
    if created:
        AuditEvent.objects.create(actor=organizer, subject=entry.volunteer, activity=activity,
                                  object_id=attendance.pk, action='attendance_confirmed')
    return attendance, created
