from django.db import transaction

from .models import EmailDelivery, Notification, NotificationPreference


@transaction.atomic
def notify(recipient, kind, title, body, activity=None, href=None, dedupe_key=None, reminder=None):
    """Persist the inbox and outbox together with the caller's business transaction."""
    if not recipient.is_active:
        return None
    values = dict(recipient=recipient, kind=kind, title=title, body=body, activity=activity,
                  href=href or (f'/hoat-dong/{activity.pk}' if activity else '/thong-bao'))
    if dedupe_key:
        item, created = Notification.objects.get_or_create(dedupe_key=dedupe_key, defaults=values)
    else:
        item, created = Notification.objects.create(**values), True
    if created and recipient.email and not NotificationPreference.objects.filter(user=recipient, email_enabled=False).exists():
        EmailDelivery.objects.create(notification=item, **(reminder or {}))
    return item


def notify_participants(activity, kind, title, body):
    for entry in activity.participations.filter(status__in=['pending', 'approved']).select_related('volunteer'):
        notify(entry.volunteer, kind, title, body, activity)
