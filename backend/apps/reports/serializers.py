from rest_framework import serializers
from apps.accounts.models import User
from apps.accounts.profile_serializers import StrictFieldsMixin
from .models import AuditEvent


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'username', 'role', 'is_active', 'date_joined']
        read_only_fields = fields


class AccountStatusSerializer(StrictFieldsMixin, serializers.Serializer):
    is_active = serializers.BooleanField()
    reason = serializers.CharField(max_length=1000, allow_blank=False, trim_whitespace=True)


class AuditSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.full_name', read_only=True, default=None)
    activity_title = serializers.CharField(source='activity.title', read_only=True, default=None)
    action_label = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditEvent
        fields = ['id', 'actor', 'actor_name', 'subject', 'subject_name', 'action', 'action_label', 'object_id', 'activity', 'activity_title', 'reason', 'created_at']
        read_only_fields = fields
