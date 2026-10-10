"""Explicit snapshots only: never serialize users, sessions or check-in secrets."""
from datetime import timezone
from .models import AuditEvent


def instant(value):
    return value.astimezone(timezone.utc).isoformat()


def activity_snapshot(activity):
    return {
        'title': activity.title, 'description': activity.description, 'address': activity.address,
        'starts_at': instant(activity.starts_at), 'ends_at': instant(activity.ends_at),
        'capacity': activity.capacity, 'status': activity.status,
        'required_skills': list(activity.required_skills.order_by('pk').values_list('name', flat=True)),
        'timeline': [dict(title=item.title, description=item.description, starts_at=instant(item.starts_at),
                          ends_at=instant(item.ends_at)) for item in activity.timeline.all()],
    }


def record_activity(actor, activity, action, before, after):
    # Called inside the same activity transaction, after validation and writes.
    if before == after:
        return
    keys = [key for key in after if before is None or before.get(key) != after[key]]
    AuditEvent.objects.create(actor=actor, activity=activity, object_id=activity.pk, action=action,
        before=None if before is None else {key: before[key] for key in keys},
        after={key: after[key] for key in keys})
