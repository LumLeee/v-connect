from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Participation
from apps.feedback.services import visible_feedback, summary as feedback_summary
from .models import AuditEvent


def activities_for(user):
    queryset = Activity.objects.select_related('organizer', 'organizer__organizer_profile')
    if user.role == 'organizer':
        return queryset.filter(organizer=user)
    if user.role == 'volunteer':
        return queryset.filter(participations__volunteer=user).distinct()
    return queryset


def participations_for(user, activity=None):
    queryset = Participation.objects.all()
    if user.role == 'volunteer':
        queryset = queryset.filter(volunteer=user)
    elif user.role == 'organizer':
        queryset = queryset.filter(activity__organizer=user)
    return queryset.filter(activity=activity) if activity else queryset


METRICS = {
    'registered': Q(), 'pending': Q(status='pending'), 'approved': Q(status='approved'),
    'rejected': Q(status='rejected'), 'cancelled': Q(status='cancelled'),
    'attended_completed': Q(attendance__isnull=False, activity__status='completed', status='approved'),
    'attended_ongoing': Q(attendance__isnull=False, activity__status='published', status='approved'),
    'attended_cancelled': Q(attendance__isnull=False, activity__status='cancelled'),
}


def metrics_for(user, activity=None):
    queryset = participations_for(user, activity)
    counts = queryset.aggregate(**{name: Count('pk', filter=condition, distinct=True) for name, condition in METRICS.items()})
    feedback = visible_feedback().filter(attendance__participation__in=queryset)
    counts['feedback'] = feedback_summary(feedback)
    return counts


@transaction.atomic
def set_account_status(actor, account_id, active, reason):
    account = get_object_or_404(User.objects.select_for_update(), pk=account_id)
    if account.role == 'admin' or account.is_staff or account.is_superuser:
        raise ValidationError('Không khóa hoặc mở khóa tài khoản quản trị qua chức năng này.')
    if account.is_active != active:
        account.is_active = active
        account.session_version += 1
        account.save(update_fields=['is_active', 'session_version'])
        AuditEvent.objects.create(actor=actor, subject=account, object_id=account.pk,
            action='account_unlocked' if active else 'account_locked', reason=reason)
    return account
