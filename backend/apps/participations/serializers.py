from rest_framework import serializers

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.activities.serializers import ActivitySerializer
from apps.activities.time_policy import attendance_open, ended, registration_open
from apps.feedback.models import Feedback
from .models import Attendance, Contribution, Participation


class AttendanceSerializer(serializers.ModelSerializer):
    confirmed_by_name = serializers.CharField(source='confirmed_by.full_name', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'confirmed_at', 'confirmed_by_name', 'method']
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


class ParticipationContributionSerializer(serializers.ModelSerializer):
    confirmed_by_name = serializers.CharField(source='confirmed_by.full_name', read_only=True)

    class Meta:
        model = Contribution
        fields = ['score', 'revision', 'confirmed_by_name', 'updated_at']
        read_only_fields = fields


class ParticipationFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['id', 'rating', 'content', 'created_at', 'is_hidden']
        read_only_fields = fields


class MyParticipationSerializer(ParticipationSerializer):
    """Own evidence and available actions, never used for applicant lists."""
    contribution = ParticipationContributionSerializer(source='attendance.contribution', read_only=True, default=None)
    feedback = ParticipationFeedbackSerializer(source='attendance.feedback', read_only=True, default=None)
    can_submit_feedback = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_check_in = serializers.SerializerMethodField()

    class Meta(ParticipationSerializer.Meta):
        fields = ParticipationSerializer.Meta.fields + [
            'contribution', 'feedback', 'can_submit_feedback', 'can_cancel', 'can_check_in',
        ]
        read_only_fields = fields

    def get_can_submit_feedback(self, participation):
        attendance = getattr(participation, 'attendance', None)
        return bool(attendance and not getattr(attendance, 'feedback', None)
                    and participation.status == 'approved'
                    and participation.activity.published_at
                    and participation.activity.status == 'completed'
                    and ended(participation.activity))

    def get_can_cancel(self, participation):
        return bool(participation.status in ['pending', 'approved']
                    and participation.activity.published_at
                    and registration_open(participation.activity))

    def get_can_check_in(self, participation):
        return bool(participation.status == 'approved'
                    and not getattr(participation, 'attendance', None)
                    and participation.activity.published_at
                    and attendance_open(participation.activity))


class ApplicantSerializer(ParticipationSerializer):
    volunteer_name = serializers.CharField(source='volunteer.full_name', read_only=True)
    volunteer_email = serializers.EmailField(source='volunteer.email', read_only=True)
    volunteer_phone = serializers.CharField(source='volunteer.phone', read_only=True)

    class Meta(ParticipationSerializer.Meta):
        fields = ParticipationSerializer.Meta.fields + ['volunteer_name', 'volunteer_email', 'volunteer_phone']


class ApplicantDetailSerializer(ApplicantSerializer):
    profile = serializers.SerializerMethodField()
    volunteer_bio = serializers.CharField(source='volunteer.bio', read_only=True)
    skills = serializers.SerializerMethodField()
    interests = serializers.SerializerMethodField()

    class Meta(ApplicantSerializer.Meta):
        fields = ApplicantSerializer.Meta.fields + ['volunteer_bio', 'skills', 'interests', 'profile']

    def get_profile(self, entry):
        from apps.accounts.profile_serializers import ProfileSerializer
        profile = dict(ProfileSerializer(entry.volunteer).data)
        profile['avatar_url'] = f'/api/v1/organizer/activities/{entry.activity_id}/applicants/{entry.pk}/avatar/' if entry.volunteer.avatar else None
        return profile

    def get_skills(self, entry):
        profile = getattr(entry.volunteer, 'volunteer_profile', None)
        return list(profile.skills.order_by('name').values_list('name', flat=True)) if profile else []

    def get_interests(self, entry):
        profile = getattr(entry.volunteer, 'volunteer_profile', None)
        return profile.interests if profile else []
