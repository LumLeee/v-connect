from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.activities.models import Activity
from apps.participations.models import Participation
from .models import EmailDelivery, Notification, NotificationPreference
from .services import notify


def create_reminders(limit=200):
    """Catch up due reminders, but never remind after the start or before approval."""
    now = timezone.now()
    ids = Activity.objects.filter(status='published', starts_at__gt=now,
                                  starts_at__lte=now + timedelta(hours=1)).values_list('pk', flat=True)
    created = 0
    for activity_id in ids.iterator():
        with transaction.atomic():
            activity = Activity.objects.select_for_update().get(pk=activity_id)
            now = timezone.now()
            due = activity.starts_at - timedelta(hours=1)
            if activity.status != 'published' or not due <= now < activity.starts_at:
                continue
            entries = activity.participations.filter(status='approved', reviewed_at__lte=due,
                                                     volunteer__is_active=True).select_related('volunteer')
            for entry in entries.iterator():
                key = f'reminder:{entry.pk}:{activity.starts_at.isoformat()}:{entry.reviewed_at.isoformat()}'
                # Existence check also avoids spending the per-run budget on old reminders.
                if Notification.objects.filter(dedupe_key=key).exists():
                    continue
                local_start = timezone.localtime(activity.starts_at).strftime('%H:%M ngày %d/%m/%Y')
                notify(entry.volunteer, 'reminder', 'Sắp đến giờ tham gia hoạt động',
                       f'“{activity.title}” bắt đầu lúc {local_start} (giờ Việt Nam). Địa điểm: {activity.address}.',
                       activity, dedupe_key=key, reminder={'reminder_participation': entry,
                           'reminder_starts_at': activity.starts_at, 'reminder_reviewed_at': entry.reviewed_at})
                created += 1
                if created >= limit:
                    return created
    return created


def reminder_valid(job):
    if job.notification.kind != 'reminder':
        return True
    return Participation.objects.filter(pk=job.reminder_participation_id, status='approved',
        reviewed_at=job.reminder_reviewed_at, activity__status='published',
        activity__starts_at=job.reminder_starts_at, activity__starts_at__gt=timezone.now()).exists()


def deliver_emails(limit=200):
    processed = 0
    for _ in range(limit):
        now = timezone.now()
        with transaction.atomic():
            # Expired claims can be retried after a worker stops unexpectedly.
            job = EmailDelivery.objects.select_for_update(skip_locked=True).filter(
                Q(status='pending', available_at__lte=now) |
                Q(status='sending', locked_at__lt=now - timedelta(minutes=15))
            ).order_by('available_at', 'pk').first()
            if job is None:
                break
            if job.attempts >= 5:
                job.status = 'failed'
                job.last_error = 'attempt_limit'
                job.save(update_fields=['status', 'last_error'])
                continue
            job.status = 'sending'
            job.attempts += 1
            job.locked_at = now
            job.save(update_fields=['status', 'attempts', 'locked_at'])
            claim = job.attempts
        job = EmailDelivery.objects.select_related('notification__recipient').get(pk=job.pk)
        note, recipient = job.notification, job.notification.recipient
        opted_out = NotificationPreference.objects.filter(user=recipient, email_enabled=False).exists()
        outcome, error = 'sent', ''
        if not recipient.is_active or not recipient.email or opted_out or not reminder_valid(job):
            outcome = 'skipped'
        else:
            try:
                message = EmailMessage(subject='[V-Connect] ' + note.title,
                    body=f'{note.body}\n\nXem chi tiết: {settings.FRONTEND_URL}{note.href}\n\n'
                         f'Tùy chọn nhận email: {settings.FRONTEND_URL}/thong-bao',
                    from_email=settings.DEFAULT_FROM_EMAIL, to=[recipient.email],
                    headers={'Message-ID': f'<notification-{note.pk}@v-connect.local>'})
                if message.send(fail_silently=False) != 1:
                    raise RuntimeError('Email backend did not accept message')
            except Exception:
                # Never persist SMTP exception text, which can contain credentials or addresses.
                outcome = 'failed' if claim >= 5 else 'pending'
                error = 'delivery_failed'
        EmailDelivery.objects.filter(pk=job.pk, status='sending', attempts=claim).update(
            status=outcome, last_error=error, locked_at=None,
            sent_at=timezone.now() if outcome == 'sent' else None,
            available_at=timezone.now() + timedelta(minutes=min(60, 2 ** claim)))
        processed += 1
    return processed
