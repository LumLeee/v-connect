from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "full_name", "role"]
        read_only_fields = fields


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Mật khẩu xác nhận không khớp."})
        try:
            validate_password(attrs["password"], self.context.get("user"))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs


class RegisterSerializer(EmailSerializer, PasswordSerializer):
    full_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=[User.Role.VOLUNTEER, User.Role.ORGANIZER])

    def validate(self, attrs):
        extra = set(self.initial_data) - set(self.fields)
        if extra:
            raise serializers.ValidationError("Yêu cầu chứa trường không được phép.")
        if User.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Email này đã được đăng ký."})
        self.context["user"] = User(email=attrs["email"], full_name=attrs["full_name"])
        return super().validate(attrs)


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, required=False)
    # Keep email-shaped requests compatible with the existing public API.
    email = serializers.EmailField(max_length=254, required=False, write_only=True)
    username = serializers.CharField(max_length=150, required=False, write_only=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    remember = serializers.BooleanField(default=False)

    def validate(self, attrs):
        identities = [name for name in ("identifier", "email", "username") if name in attrs]
        if len(identities) != 1:
            raise serializers.ValidationError({"identifier": "Nhập email hoặc username Admin bằng một trường duy nhất."})
        attrs["identifier"] = attrs.pop(identities[0]).strip().lower()
        return attrs


class ResetConfirmSerializer(PasswordSerializer):
    uid = serializers.CharField(max_length=100)
    token = serializers.CharField(max_length=128)
