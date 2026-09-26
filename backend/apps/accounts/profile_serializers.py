import re

from rest_framework import serializers

from .models import OrganizerProfile, User


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


class ProfileSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    organizer = OrganizerProfileSerializer(source="organizer_profile", required=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "full_name", "phone", "bio", "avatar_url", "organizer"]
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
        return attrs

    def update(self, instance, validated_data):
        organizer = validated_data.pop("organizer_profile", None)
        for name, value in validated_data.items():
            setattr(instance, name, value)
        if validated_data:
            instance.save(update_fields=list(validated_data))
        if organizer is not None:
            OrganizerProfile.objects.update_or_create(user=instance, defaults=organizer)
        return instance
