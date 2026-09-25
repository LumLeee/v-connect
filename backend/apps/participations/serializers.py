from rest_framework import serializers

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.activities.serializers import ActivitySerializer
from .models import Attendance, Participation


class AttendanceSerializer(serializers.ModelSerializer):
    confirmed_by_name = serializers.CharField(source='confirmed_by.full_name', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'confirmed_at', 'confirmed_by_name']
        read_only_fields = fields


class EmptySerializer(StrictFieldsMixin, serializers.Serializer):
    pass


class ReviewSerializer(StrictFieldsMixin, serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved', 'rejected'])


class ParticipationSerializer(serializers.ModelSerializer):
    activity = ActivitySerializer(read_only=True)
    activity_changed = serializers.SerializerMethodField()
    attendance = AttendanceSerializer(read_only=True)

    class Meta:
        model = Participation
        fields = ['id', 'activity', 'status', 'cancellation_reason', 'registered_at', 'updated_at', 'reviewed_at', 'activity_changed', 'attendance']

    def get_activity_changed(self, participation):
        activity = participation.activity
        return (activity.starts_at != participation.registered_starts_at
                or activity.ends_at != participation.registered_ends_at
                or activity.address != participation.registered_address)


class ApplicantSerializer(ParticipationSerializer):
    volunteer_name = serializers.CharField(source='volunteer.full_name', read_only=True)
    volunteer_email = serializers.EmailField(source='volunteer.email', read_only=True)
    volunteer_phone = serializers.CharField(source='volunteer.phone', read_only=True)

    class Meta(ParticipationSerializer.Meta):
        fields = ParticipationSerializer.Meta.fields + ['volunteer_name', 'volunteer_email', 'volunteer_phone']
