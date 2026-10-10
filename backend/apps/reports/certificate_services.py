from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.activities.models import Activity
from apps.participations.models import Attendance, Contribution
from .models import AuditEvent, Certificate


def require_manager(actor, activity):
    if actor.role != 'admin' and (actor.role != 'organizer' or activity.organizer_id != actor.pk):
        raise PermissionDenied('Bạn không có quyền cấp hoặc thu hồi chứng nhận của hoạt động này.')


def record_certificate(actor, certificate, action, before, after, reason=''):
    entry = certificate.attendance.participation
    AuditEvent.objects.create(actor=actor, subject=entry.volunteer, activity=entry.activity,
        object_id=certificate.pk, action=action, before=before, after=after, reason=reason)


@transaction.atomic
def issue_certificate(actor, activity_id, attendance_id):
    activity = get_object_or_404(Activity.objects.select_for_update().select_related('organizer__organizer_profile'), pk=activity_id)
    require_manager(actor, activity)
    if activity.status != 'completed' or activity.ends_at > timezone.now():
        raise ValidationError('Chỉ cấp chứng nhận khi hoạt động Hoàn thành và đã kết thúc.')
    attendance = get_object_or_404(Attendance.objects.select_related('participation__volunteer', 'participation__activity'),
        pk=attendance_id, participation__activity=activity, participation__status='approved')
    contribution = Contribution.objects.filter(attendance=attendance, minutes__gt=0).first()
    if contribution is None:
        raise ValidationError('Người tham gia cần có số phút đóng góp được xác nhận lớn hơn 0.')
    current = Certificate.objects.filter(active_attendance=attendance).first()
    if current:
        return current, False
    profile = getattr(activity.organizer, 'organizer_profile', None)
    certificate = Certificate.objects.create(attendance=attendance, active_attendance=attendance,
        volunteer_name=attendance.participation.volunteer.full_name, activity_title=activity.title,
        organization_name=(profile.organization_name if profile else '') or activity.organizer.full_name,
        starts_at=activity.starts_at, ends_at=activity.ends_at, minutes=contribution.minutes,
        contribution_revision=contribution.revision, issued_by=actor, issued_by_name=actor.full_name)
    record_certificate(actor, certificate, 'certificate_issued', None,
        {'minutes': certificate.minutes, 'revision': certificate.contribution_revision, 'certificate_status': 'valid'})
    return certificate, True


def revoke_locked(actor, certificate, reason):
    # Caller holds the activity lock inside a transaction, shared with contribution updates.
    if certificate.revoked_at:
        return certificate
    certificate.revoked_at = timezone.now()
    certificate.revoked_by = actor
    certificate.revocation_reason = reason
    certificate.active_attendance = None
    certificate.save(update_fields=['revoked_at', 'revoked_by', 'revocation_reason', 'active_attendance'])
    record_certificate(actor, certificate, 'certificate_revoked', {'certificate_status': 'valid'},
        {'certificate_status': 'revoked'}, reason)
    return certificate


@transaction.atomic
def revoke_certificate(actor, certificate_id, reason):
    certificate = get_object_or_404(Certificate.objects.select_related('attendance__participation'), pk=certificate_id)
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=certificate.attendance.participation.activity_id)
    require_manager(actor, activity)
    certificate.refresh_from_db()
    return revoke_locked(actor, certificate, reason)


def revoke_for_contribution(actor, attendance):
    certificate = Certificate.objects.filter(active_attendance=attendance).first()
    if certificate:
        revoke_locked(actor, certificate, 'Số phút đóng góp đã được điều chỉnh. Cần cấp chứng nhận mới theo dữ liệu đã xác nhận.')
