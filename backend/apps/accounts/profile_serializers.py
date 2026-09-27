import re

from rest_framework import serializers

from apps.core.models import Skill
from .models import AvailabilitySlot, OrganizerProfile, User, VolunteerProfile


class StrictFieldsMixin:
    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            allowed = {name for name, field in self.fields.items() if not field.read_only}
            extra = set(data.keys()) - allowed
            if extra:
                raise serializers.ValidationError({name: "Không được cập nhật trường này." for name in extra})
        return super().to_internal_value(data)


class OrganizerProfileSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = OrganizerProfile
        fields = ["organization_name", "description", "website", "contact_address"]

    def validate_website(self, value):
        if value and not value.lower().startswith(("https://", "http://")):
            raise serializers.ValidationError("Website phải bắt đầu bằng https:// hoặc http://.")
        return value


class AvailabilitySerializer(StrictFieldsMixin, serializers.ModelSerializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    starts_at = serializers.TimeField(format='%H:%M', input_formats=['%H:%M'])
    ends_at = serializers.TimeField(format='%H:%M', input_formats=['%H:%M'])

    class Meta:
        model = AvailabilitySlot
        fields = ['weekday', 'starts_at', 'ends_at']

    def validate(self, attrs):
        if set(attrs) != set(self.Meta.fields):
            raise serializers.ValidationError('Mỗi khung giờ cần đủ ngày, giờ bắt đầu và giờ kết thúc.')
        if attrs['starts_at'] >= attrs['ends_at']:
            raise serializers.ValidationError('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.')
        return attrs


class VolunteerProfileSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    skills = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all(), many=True, required=False)
    interests = serializers.ListField(child=serializers.CharField(max_length=80), max_length=20, required=False)
    availability = AvailabilitySerializer(many=True, required=False)

    class Meta:
        model = VolunteerProfile
        fields = ['skills', 'interests', 'availability']

    def validate_skills(self, value):
        if len(value) > 20:
            raise serializers.ValidationError('Chọn tối đa 20 kỹ năng.')
        if len({skill.pk for skill in value}) != len(value):
            raise serializers.ValidationError('Không chọn trùng kỹ năng.')
        return value

    def validate_interests(self, value):
        if len({item.casefold() for item in value}) != len(value):
            raise serializers.ValidationError('Không nhập trùng sở thích.')
        return value

    def validate_availability(self, value):
        if len(value) > 28:
            raise serializers.ValidationError('Nhập tối đa 28 khung giờ mỗi tuần.')
        ordered = sorted(value, key=lambda slot: (slot['weekday'], slot['starts_at']))
        for previous, current in zip(ordered, ordered[1:]):
            if previous['weekday'] == current['weekday'] and current['starts_at'] < previous['ends_at']:
                raise serializers.ValidationError('Các khung giờ trong cùng ngày không được trùng hoặc chồng lấn.')
        return ordered


class ProfileSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    organizer = OrganizerProfileSerializer(source="organizer_profile", required=False)
    volunteer = VolunteerProfileSerializer(source='volunteer_profile', required=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "full_name", "phone", "bio", "avatar_url", "organizer", "volunteer"]
        read_only_fields = ["id", "email", "username", "role", "avatar_url"]

    def get_avatar_url(self, user):
        return "/api/v1/auth/profile/avatar/" if user.avatar else None

    def validate_phone(self, value):
        if value and (not re.fullmatch(r"\+?[0-9 ()\-.]+", value) or not 7 <= len(re.sub(r"\D", "", value)) <= 15):
            raise serializers.ValidationError("Nhập số điện thoại có từ 7 đến 15 chữ số.")
        return value

    def validate(self, attrs):
        if "organizer_profile" in attrs and self.instance.role != User.Role.ORGANIZER:
            raise serializers.ValidationError({"organizer": "Chỉ Nhà tổ chức được cập nhật hồ sơ tổ chức."})
        if 'volunteer_profile' in attrs and self.instance.role != User.Role.VOLUNTEER:
            raise serializers.ValidationError({'volunteer': 'Chỉ Tình nguyện viên được cập nhật hồ sơ mở rộng.'})
        return attrs

    def update(self, instance, validated_data):
        organizer = validated_data.pop("organizer_profile", None)
        volunteer = validated_data.pop('volunteer_profile', None)
        for name, value in validated_data.items():
            setattr(instance, name, value)
        if validated_data:
            instance.save(update_fields=list(validated_data))
        if organizer is not None:
            OrganizerProfile.objects.update_or_create(user=instance, defaults=organizer)
        if volunteer is not None:
            profile, _ = VolunteerProfile.objects.get_or_create(user=instance)
            if 'interests' in volunteer:
                profile.interests = volunteer['interests']
                profile.save(update_fields=['interests'])
            if 'skills' in volunteer:
                profile.skills.set(volunteer['skills'])
            if 'availability' in volunteer:
                profile.availability.all().delete()
                AvailabilitySlot.objects.bulk_create([
                    AvailabilitySlot(profile=profile, **slot) for slot in volunteer['availability']
                ])
        return instance
