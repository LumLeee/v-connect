from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.notifications.services import notify
from apps.reports.models import AuditEvent
from .models import Invitation, Participation
from .services import require_open, require_space


def require_eligible_entry(activity, volunteer):
    entry = Participation.objects.filter(activity=activity, volunteer=volunteer).first()
    if entry and not (entry.status == 'pending' or
                      (entry.status == 'cancelled' and entry.cancellation_reason == 'volunteer')):
        raise ValidationError('Người này đã được duyệt, bị từ chối hoặc không còn đủ điều kiện đăng ký lại.')
    return entry


def record(invitation, actor, action, previous):
    AuditEvent.objects.create(actor=actor, subject=invitation.volunteer, activity=invitation.activity,
        object_id=invitation.pk, action=action, before={'status': previous} if previous else None,
        after={'status': invitation.status})


@transaction.atomic
def send(activity_id, organizer, volunteer_id, message=''):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=organizer)
    require_open(activity)
    if not activity.published_at or not organizer.is_active:
        raise ValidationError('Hoạt động chưa sẵn sàng gửi lời mời.')
    volunteer = get_object_or_404(User, pk=volunteer_id, role='volunteer', is_active=True,
                                 volunteer_profile__matching_visible=True)
    existing = Invitation.objects.filter(activity=activity, volunteer=volunteer).first()
    if existing:
        # Do not resend notifications or override a volunteer's decision.
        return existing, False
    require_eligible_entry(activity, volunteer)
    require_space(activity)
    invitation = Invitation.objects.create(activity=activity, volunteer=volunteer, sent_by=organizer,
        message=message, invited_starts_at=activity.starts_at, invited_ends_at=activity.ends_at,
        invited_address=activity.address)
    record(invitation, organizer, 'invitation_sent', None)
    notify(volunteer, 'invitation', 'Bạn nhận được lời mời tham gia',
        f'{organizer.full_name} mời bạn tham gia “{activity.title}”.' + (f' Lời nhắn: {message}' if message else ''),
        activity, href='/tinh-nguyen-vien/loi-moi')
    return invitation, True


@transaction.atomic
def respond(invitation_id, volunteer, target):
    if target not in ['accepted', 'declined']:
        raise ValidationError('Phản hồi lời mời không hợp lệ.')
    reference = get_object_or_404(Invitation, pk=invitation_id, volunteer=volunteer)
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=reference.activity_id)
    invitation = Invitation.objects.select_related('volunteer', 'activity').get(pk=reference.pk)
    if invitation.status == target:
        return invitation
    if invitation.status != 'pending':
        raise ValidationError('Lời mời đã được xử lý; không thể đổi phản hồi.')
    if target == 'accepted':
        require_open(activity)
        if not activity.published_at or not activity.organizer.is_active or not volunteer.is_active:
            raise ValidationError('Hoạt động hoặc tài khoản không còn khả dụng.')
        entry = require_eligible_entry(activity, volunteer)
        require_space(activity)
        previous = entry.status if entry else None
        if entry is None:
            entry = Participation(activity=activity, volunteer=volunteer)
        entry.status = 'approved'
        entry.cancellation_reason = ''
        entry.reviewed_by = invitation.sent_by
        entry.reviewed_at = timezone.now()
        if previous != 'pending':
            entry.registered_at = timezone.now()
        entry.registered_starts_at = activity.starts_at
        entry.registered_ends_at = activity.ends_at
        entry.registered_address = activity.address
        entry.save()
        AuditEvent.objects.create(actor=volunteer, subject=volunteer, activity=activity, object_id=entry.pk,
            action='review_approved', before={'status': previous},
            after={'status': 'approved', 'source': 'invitation', 'invitation_id': str(invitation.pk)})
        notify(volunteer, 'review_approved', 'Đăng ký đã được tự động duyệt',
            f'Bạn đã xác nhận lời mời tham gia “{activity.title}”. Đăng ký của bạn đã được duyệt.', activity,
            href='/tinh-nguyen-vien/dang-ky')
    invitation.status = target
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=['status', 'responded_at'])
    record(invitation, volunteer, 'invitation_accepted' if target == 'accepted' else 'invitation_declined', 'pending')
    notify(activity.organizer, 'invitation_response', 'Có phản hồi lời mời tham gia',
        f'{volunteer.full_name} đã {"chấp nhận" if target == "accepted" else "từ chối"} lời mời “{activity.title}”.',
        activity, href=f'/nha-to-chuc/hoat-dong/{activity.pk}/loi-moi')
    return invitation


@transaction.atomic
def withdraw(activity_id, invitation_id, organizer):
    activity = get_object_or_404(Activity.objects.select_for_update(), pk=activity_id, organizer=organizer)
    invitation = get_object_or_404(Invitation.objects.select_related('volunteer'), pk=invitation_id, activity=activity)
    if invitation.status == 'withdrawn':
        return invitation
    if invitation.status != 'pending':
        raise ValidationError('Chỉ thu hồi lời mời đang chờ phản hồi.')
    invitation.status = 'withdrawn'
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=['status', 'responded_at'])
    record(invitation, organizer, 'invitation_withdrawn', 'pending')
    notify(invitation.volunteer, 'invitation_withdrawn', 'Lời mời đã được thu hồi',
        f'Nhà tổ chức đã thu hồi lời mời tham gia “{activity.title}”.', activity,
        href='/tinh-nguyen-vien/loi-moi')
    return invitation
