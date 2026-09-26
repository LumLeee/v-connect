from rest_framework import serializers

from apps.accounts.profile_serializers import StrictFieldsMixin
from .models import Feedback


class SubmitSerializer(StrictFieldsMixin, serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    content = serializers.CharField(max_length=2000, allow_blank=False, trim_whitespace=True)


class HideSerializer(StrictFieldsMixin, serializers.Serializer):
    reason = serializers.CharField(max_length=1000, allow_blank=False, trim_whitespace=True)


class FeedbackSerializer(serializers.ModelSerializer):
    activity_id = serializers.UUIDField(source='attendance.participation.activity_id', read_only=True)
    activity_title = serializers.CharField(source='attendance.participation.activity.title', read_only=True)
    volunteer_name = serializers.CharField(source='attendance.participation.volunteer.full_name', read_only=True)

    class Meta:
        model = Feedback
        fields = ['id', 'activity_id', 'activity_title', 'volunteer_name', 'rating', 'content', 'created_at']
        read_only_fields = fields


class OwnFeedbackSerializer(FeedbackSerializer):
    class Meta(FeedbackSerializer.Meta):
        fields = FeedbackSerializer.Meta.fields + ['is_hidden', 'hidden_reason', 'hidden_at']
        read_only_fields = fields


class AdminFeedbackSerializer(OwnFeedbackSerializer):
    hidden_by_name = serializers.CharField(source='hidden_by.full_name', read_only=True, default=None)

    class Meta(OwnFeedbackSerializer.Meta):
        fields = OwnFeedbackSerializer.Meta.fields + ['hidden_by', 'hidden_by_name']
        read_only_fields = fields
