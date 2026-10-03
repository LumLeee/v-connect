from datetime import datetime, time
from zoneinfo import ZoneInfo

from rest_framework import serializers
from apps.core.models import Skill


class ActivityFilters(serializers.Serializer):
    status = serializers.ChoiceField(choices=['published', 'completed', 'cancelled', 'draft'], required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    location = serializers.CharField(max_length=200, required=False)
    skill = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all(), required=False)

    def validate(self, attrs):
        if attrs.get('date_from') and attrs.get('date_to') and attrs['date_from'] > attrs['date_to']:
            raise serializers.ValidationError({'date_to': 'Ngày đến phải bằng hoặc sau ngày từ.'})
        return attrs


def filter_activities(queryset, request, managed=False):
    values = {name: request.query_params[name] for name in ActivityFilters().fields if request.query_params.get(name)}
    serializer = ActivityFilters(data=values)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if data.get('status') == 'draft' and not managed:
        raise serializers.ValidationError({'status': 'Danh sách công khai không bao gồm bản nháp.'})
    if data.get('status'):
        queryset = queryset.filter(status=data['status'])
    zone = ZoneInfo('Asia/Ho_Chi_Minh')
    if data.get('date_from'):
        queryset = queryset.filter(starts_at__gte=datetime.combine(data['date_from'], time.min, tzinfo=zone))
    if data.get('date_to'):
        queryset = queryset.filter(starts_at__lte=datetime.combine(data['date_to'], time.max, tzinfo=zone))
    if data.get('location'):
        queryset = queryset.filter(address__icontains=data['location'])
    if data.get('skill'):
        queryset = queryset.filter(required_skills=data['skill'])
    return queryset.distinct()
