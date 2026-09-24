from django.utils import timezone
from rest_framework import serializers

from apps.accounts.profile_serializers import StrictFieldsMixin
from .models import Activity


class ActivitySerializer(StrictFieldsMixin, serializers.ModelSerializer):
    organizer_name = serializers.SerializerMethodField()
    capacity = serializers.IntegerField(min_value=1, max_value=100000)

    class Meta:
        model = Activity
        fields = ['id', 'title', 'description', 'address', 'starts_at', 'ends_at', 'capacity',
                  'status', 'organizer_name', 'published_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'organizer_name', 'published_at', 'created_at', 'updated_at']

    def get_organizer_name(self, activity):
        profile = getattr(activity.organizer, 'organizer_profile', None)
        return (profile.organization_name if profile else '') or activity.organizer.full_name

    def validate(self, attrs):
        start = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        end = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if start and end and end <= start:
            raise serializers.ValidationError({'ends_at': 'Thời gian kết thúc phải sau thời gian bắt đầu.'})
        if 'starts_at' in attrs and start <= timezone.now():
            raise serializers.ValidationError({'starts_at': 'Thời gian bắt đầu phải ở tương lai.'})
        return attrs


class TransitionSerializer(StrictFieldsMixin, serializers.Serializer):
    status = serializers.ChoiceField(choices=['published', 'completed', 'cancelled'])
