from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.core.models import Skill
from apps.core.serializers import SkillSerializer
from .models import Activity, ActivityMilestone


class MilestoneSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = ActivityMilestone
        fields = ['title', 'description', 'starts_at', 'ends_at']

    def validate(self, attrs):
        missing = [name for name in ['title', 'starts_at', 'ends_at'] if name not in attrs]
        if missing:
            raise serializers.ValidationError({name: 'Trường này là bắt buộc.' for name in missing})
        if attrs['ends_at'] <= attrs['starts_at']:
            raise serializers.ValidationError('Mốc chương trình phải kết thúc sau thời gian bắt đầu.')
        return attrs


class ActivitySerializer(StrictFieldsMixin, serializers.ModelSerializer):
    organizer_name = serializers.SerializerMethodField()
    capacity = serializers.IntegerField(min_value=1, max_value=100000)
    approved_count = serializers.SerializerMethodField()
    required_skills = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all(), many=True, required=False)
    skill_details = SkillSerializer(source='required_skills', many=True, read_only=True)
    cover_url = serializers.SerializerMethodField()
    timeline = MilestoneSerializer(many=True, required=False, max_length=50)

    class Meta:
        model = Activity
        fields = ['id', 'title', 'description', 'address', 'starts_at', 'ends_at', 'capacity',
                  'status', 'organizer_name', 'published_at', 'created_at', 'updated_at', 'approved_count',
                  'required_skills', 'skill_details', 'cover_url', 'timeline']
        read_only_fields = ['id', 'status', 'organizer_name', 'published_at', 'created_at', 'updated_at']

    def get_organizer_name(self, activity):
        profile = getattr(activity.organizer, 'organizer_profile', None)
        return (profile.organization_name if profile else '') or activity.organizer.full_name

    def get_approved_count(self, activity):
        if hasattr(activity, 'matching_approved'):
            return activity.matching_approved
        return activity.participations.filter(status='approved').count()

    def get_cover_url(self, activity):
        return f'/api/v1/activities/{activity.pk}/cover/?v={activity.cover.name.rsplit("/", 1)[-1]}' if activity.cover else None

    def validate_required_skills(self, skills):
        if len(skills) > 20:
            raise serializers.ValidationError('Chọn tối đa 20 kỹ năng yêu cầu.')
        if len({skill.pk for skill in skills}) != len(skills):
            raise serializers.ValidationError('Không chọn trùng kỹ năng yêu cầu.')
        return skills

    def validate(self, attrs):
        start = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        end = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if start and end and end <= start:
            raise serializers.ValidationError({'ends_at': 'Thời gian kết thúc phải sau thời gian bắt đầu.'})
        changed_start = 'starts_at' in attrs and (self.instance is None or start != self.instance.starts_at)
        if changed_start and start < timezone.now() + timedelta(hours=24):
            raise serializers.ValidationError({'starts_at': 'Thời gian bắt đầu phải cách thời điểm hiện tại ít nhất 24 giờ.'})
        milestones = attrs.get('timeline')
        if milestones is None and self.instance:
            milestones = list(self.instance.timeline.values('starts_at', 'ends_at'))
        for milestone in milestones or []:
            if milestone['starts_at'] < start or milestone['ends_at'] > end:
                raise serializers.ValidationError({'timeline': 'Tất cả mốc chương trình phải nằm trong thời gian hoạt động. Hãy điều chỉnh các mốc khi đổi lịch.'})
        return attrs

    def create(self, validated_data):
        milestones = validated_data.pop('timeline', [])
        activity = super().create(validated_data)
        ActivityMilestone.objects.bulk_create([ActivityMilestone(activity=activity, **item) for item in milestones])
        return activity

    def update(self, instance, validated_data):
        milestones = validated_data.pop('timeline', None)
        activity = super().update(instance, validated_data)
        if milestones is not None:
            activity.timeline.all().delete()
            ActivityMilestone.objects.bulk_create([ActivityMilestone(activity=activity, **item) for item in milestones])
        return activity


class TransitionSerializer(StrictFieldsMixin, serializers.Serializer):
    status = serializers.ChoiceField(choices=['published', 'completed', 'cancelled'])
