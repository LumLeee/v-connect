from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.core.validators import MinValueValidator, MaxValueValidator
from rest_framework import serializers

from .models import AuditEvent


class AuditFilters(serializers.Serializer):
    action = serializers.ChoiceField(choices=AuditEvent._meta.get_field('action').choices, required=False)
    date_from = serializers.DateField(required=False, validators=[MinValueValidator(date(1000, 1, 2)), MaxValueValidator(date(9999, 12, 30))])
    date_to = serializers.DateField(required=False, validators=[MinValueValidator(date(1000, 1, 2)), MaxValueValidator(date(9999, 12, 30))])
    actor = serializers.UUIDField(required=False)
    subject = serializers.UUIDField(required=False)
    activity = serializers.UUIDField(required=False)
    object_id = serializers.UUIDField(required=False)
    actor_search = serializers.CharField(max_length=200, required=False)
    subject_search = serializers.CharField(max_length=200, required=False)
    activity_search = serializers.CharField(max_length=200, required=False)

    def validate(self, attrs):
        if attrs.get('date_from') and attrs.get('date_to') and attrs['date_from'] > attrs['date_to']:
            raise serializers.ValidationError('Ngày kết thúc bộ lọc phải bằng hoặc sau ngày bắt đầu.')
        return attrs


def filter_audit(queryset, params):
    filters = AuditFilters(data={key: value for key, value in params.items() if value != ''})
    filters.is_valid(raise_exception=True)
    values = filters.validated_data
    for name in ['action', 'actor', 'subject', 'activity', 'object_id']:
        if name in values:
            queryset = queryset.filter(**{name: values[name]})
    zone = ZoneInfo('Asia/Ho_Chi_Minh')
    if values.get('date_from'):
        queryset = queryset.filter(created_at__gte=datetime.combine(values['date_from'], time.min, zone))
    if values.get('date_to'):
        queryset = queryset.filter(created_at__lte=datetime.combine(values['date_to'], time.max, zone))
    for relation in ['actor', 'subject']:
        term = values.get(relation + '_search')
        if term:
            queryset = queryset.filter(Q(**{relation + '__full_name__icontains': term}) |
                Q(**{relation + '__email__icontains': term}) | Q(**{relation + '__username__icontains': term}))
    if values.get('activity_search'):
        queryset = queryset.filter(activity__title__icontains=values['activity_search'])
    return queryset
