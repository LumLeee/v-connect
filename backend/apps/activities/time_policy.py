"""One reversible switch for activity-time gates; never bypass auth or state checks."""
from django.conf import settings
from django.utils import timezone


def enabled():
    return settings.ACTIVITY_TIME_CHECKS_ENABLED


def registration_open(activity):
    return activity.status == 'published' and (not enabled() or activity.starts_at > timezone.now())


def attendance_open(activity, now=None):
    now = now or timezone.now()
    return activity.status == 'published' and (not enabled() or activity.starts_at <= now <= activity.ends_at)


def ended(activity):
    return not enabled() or activity.ends_at <= timezone.now()
