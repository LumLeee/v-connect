from collections import Counter
from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from .services import METRICS, activities_for

MAX_ACTIVITIES = 2000
VIETNAM = ZoneInfo('Asia/Ho_Chi_Minh')
STATUSES = {'draft': 'Nháp', 'published': 'Công khai', 'completed': 'Hoàn thành', 'cancelled': 'Đã hủy'}
LABELS = {
    'registered': 'Tổng đơn đăng ký', 'pending': 'Chờ duyệt', 'approved': 'Được duyệt',
    'rejected': 'Bị từ chối', 'cancelled': 'Đã hủy đăng ký',
    'attended_completed': 'Đã tham gia (hoàn thành)', 'attended_ongoing': 'Có mặt (chưa hoàn thành)',
    'attended_cancelled': 'Có mặt (hoạt động bị hủy)',
}


class ReportFilters(serializers.Serializer):
    search = serializers.CharField(max_length=200, required=False)
    status = serializers.ChoiceField(choices=list(STATUSES), required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    organizer = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='organizer'), required=False)

    def validate(self, attrs):
        for key in ['date_from', 'date_to']:
            if key in attrs and attrs[key].year < 1001:
                raise serializers.ValidationError({key: 'Vui lòng chọn ngày từ năm 1001 trở đi.'})
        if attrs.get('date_from') and attrs.get('date_to') and attrs['date_from'] > attrs['date_to']:
            raise serializers.ValidationError({'date_to': 'Ngày đến phải bằng hoặc sau ngày từ.'})
        return attrs


def organizer_name(user):
    profile = getattr(user, 'organizer_profile', None)
    return (profile.organization_name if profile else '') or user.full_name


def filtered_activities(user, params):
    if user.role not in ['organizer', 'admin']:
        raise PermissionDenied('Chỉ Nhà tổ chức và Admin được xem báo cáo mở rộng.')
    if params.get('organizer') and user.role != 'admin':
        raise PermissionDenied('Chỉ Admin được lọc theo Nhà tổ chức.')
    serializer = ReportFilters(data={key: params[key] for key in ReportFilters().fields if params.get(key)})
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    activities = activities_for(user)
    if values.get('search'):
        activities = activities.filter(title__icontains=values['search'])
    if values.get('status'):
        activities = activities.filter(status=values['status'])
    if values.get('organizer'):
        activities = activities.filter(organizer=values['organizer'])
    if values.get('date_from'):
        activities = activities.filter(starts_at__gte=datetime.combine(values['date_from'], time.min, tzinfo=VIETNAM))
    if values.get('date_to'):
        activities = activities.filter(starts_at__lte=datetime.combine(values['date_to'], time.max, tzinfo=VIETNAM))
    filters = {key: str(value.pk) if key == 'organizer' else str(value) for key, value in values.items()}
    scope = organizer_name(values['organizer']) if values.get('organizer') else (
        organizer_name(user) if user.role == 'organizer' else 'Toàn hệ thống')
    return activities, filters, scope


def prefix_participation(condition):
    # Reuse the established participation rules without changing their meaning.
    result = Q()
    result.connector, result.negated = condition.connector, condition.negated
    result.children = [prefix_participation(child) if isinstance(child, Q) else ('participations__' + child[0], child[1])
                       for child in condition.children]
    return result


def build_report(user, params):
    activities, filters, scope = filtered_activities(user, params)
    visible = Q(participations__attendance__feedback__is_hidden=False,
                participations__status='approved', status='completed')
    annotations = {f'report_{name}': Count('participations', filter=prefix_participation(condition), distinct=True)
                   for name, condition in METRICS.items()}
    annotations.update({f'rating_{rating}': Count('participations__attendance__feedback',
        filter=visible & Q(participations__attendance__feedback__rating=rating), distinct=True) for rating in range(1, 6)})
    # One aggregate SELECT gives a consistent view; no joins to skills or other many-to-many tables.
    snapshot = list(activities.annotate(**annotations).order_by('starts_at', 'id')[:MAX_ACTIVITIES + 1])
    if len(snapshot) > MAX_ACTIVITIES:
        raise ValidationError(f'Báo cáo tối đa {MAX_ACTIVITIES} hoạt động. Vui lòng thu hẹp khoảng ngày hoặc bộ lọc.')
    rows, months = [], {}
    total = Counter({name: 0 for name in METRICS})
    ratings = Counter({str(rating): 0 for rating in range(1, 6)})
    statuses = Counter({status: 0 for status in STATUSES})
    for activity in snapshot:
        metrics = {name: getattr(activity, f'report_{name}') for name in METRICS}
        distribution = {str(rating): getattr(activity, f'rating_{rating}') for rating in range(1, 6)}
        count = sum(distribution.values())
        average = round(sum(int(rating) * count for rating, count in distribution.items()) / count, 2) if count else None
        start = timezone.localtime(activity.starts_at, VIETNAM)
        rows.append({'id': str(activity.pk), 'title': activity.title, 'organizer_name': organizer_name(activity.organizer),
                     'status': activity.status, 'starts_at': start.isoformat(),
                     'ends_at': timezone.localtime(activity.ends_at, VIETNAM).isoformat(),
                     'metrics': metrics, 'feedback': {'count': count, 'average_rating': average}})
        total.update(metrics)
        ratings.update(distribution)
        statuses[activity.status] += 1
        month = start.strftime('%Y-%m')
        bucket = months.setdefault(month, {'month': month, 'activities': 0, 'registered': 0, 'attended_completed': 0, 'feedback': 0})
        bucket['activities'] += 1
        bucket['registered'] += metrics['registered']
        bucket['attended_completed'] += metrics['attended_completed']
        bucket['feedback'] += count
    count = sum(ratings.values())
    return {'generated_at': timezone.localtime(timezone.now(), VIETNAM).isoformat(), 'scope': scope,
            'filters': filters, 'activity_count': len(rows), 'activity_statuses': dict(statuses),
            'metrics': dict(total), 'feedback': {'count': count, 'average_rating':
                round(sum(int(rating) * amount for rating, amount in ratings.items()) / count, 2) if count else None,
                'distribution': dict(ratings)}, 'months': list(months.values()), 'rows': rows}
