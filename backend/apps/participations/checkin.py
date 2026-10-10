import uuid
from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.exceptions import ValidationError

from apps.activities.models import Activity
from apps.reports.models import AuditEvent
from .models import AttendanceCode, Participation
from .services import record_attendance


def credentials(session):
    # Derive credentials with a server secret; never store a usable code/token.
    value = f'{session.pk}:{session.activity_id}:{session.nonce}'
    token = salted_hmac('vconnect.attendance.qr', value, algorithm='sha256').hexdigest()
    digest = salted_hmac('vconnect.attendance.code', value, algorithm='sha256').hexdigest()
    return token, f'{int(digest, 16) % 100000000:08d}'


def require_window(activity):
    now = timezone.now()
    if activity.status != 'published' or not activity.starts_at <= now <= activity.ends_at:
        raise ValidationError('Chỉ check-in trong thời gian hoạt động đang diễn ra và còn Công khai.')
    return now


def audit_session(session):
    return None if session is None else {
        'issued_at': session.issued_at.isoformat(), 'expires_at': session.expires_at.isoformat(),
        'revoked_at': session.revoked_at.isoformat() if session.revoked_at else None,
    }


def session_data(activity):
    now = timezone.now()
    session = AttendanceCode.objects.filter(activity=activity).first()
    active = bool(session and not session.revoked_at and now < session.expires_at
                  and activity.status == 'published' and activity.starts_at <= now <= activity.ends_at)
    result = {'active': active, 'expires_at': session.expires_at if session else None, 'server_time': now}
    if active:
        token, code = credentials(session)
        result.update(code=code, qr_value=f'vconnect:checkin:{activity.pk}:{token}')
    return result


@transaction.atomic
def issue(activity_id, organizer):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=organizer)
    now = require_window(activity)
    if now >= activity.ends_at:
        raise ValidationError('Hoạt động đã đến giờ kết thúc; không thể tạo mã mới.')
    session = AttendanceCode.objects.filter(activity=activity).first()
    old_code = credentials(session)[1] if session else None
    before = audit_session(session)
    if session is None:
        session = AttendanceCode(activity=activity)
    session.issued_by = organizer
    session.issued_at = now
    session.expires_at = min(now + timedelta(minutes=5), activity.ends_at)
    session.revoked_at = None
    while True:
        session.nonce = uuid.uuid4()
        if credentials(session)[1] != old_code:
            break
    session.save()
    AuditEvent.objects.create(actor=organizer, activity=activity, object_id=session.pk, action='attendance_code_issued',
                              before=before, after=audit_session(session))
    return session_data(activity)


@transaction.atomic
def revoke(activity_id, organizer):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=organizer)
    session = AttendanceCode.objects.filter(activity=activity).first()
    if session and not session.revoked_at:
        before = audit_session(session)
        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at'])
        AuditEvent.objects.create(actor=organizer, activity=activity, object_id=session.pk, action='attendance_code_revoked',
                                  before=before, after=audit_session(session))
    return session_data(activity)


@transaction.atomic
def check_in(activity_id, volunteer, payload):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, published_at__isnull=False)
    now = require_window(activity)
    entry = get_object_or_404(Participation.objects.select_related('volunteer'), activity=activity, volunteer=volunteer)
    if entry.status != 'approved' or not volunteer.is_active:
        raise ValidationError('Bạn phải có đăng ký được duyệt để check-in.')
    session = AttendanceCode.objects.filter(activity=activity).first()
    if not session or session.revoked_at or now >= session.expires_at:
        raise ValidationError('Mã chưa được mở, đã hết hạn hoặc bị thu hồi. Hãy xin mã mới từ Nhà tổ chức.')
    token, code = credentials(session)
    method = 'qr' if 'token' in payload else 'code'
    if not constant_time_compare(payload.get('token', payload.get('code', '')), token if method == 'qr' else code):
        raise ValidationError('Mã không hợp lệ hoặc đã được thay thế. Hãy kiểm tra lại mã của hoạt động này.')
    return record_attendance(activity, entry, volunteer, method)
