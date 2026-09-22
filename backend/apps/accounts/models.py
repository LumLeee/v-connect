import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email=None, password=None, **extra_fields):
        if not email and extra_fields.get("role", "volunteer") != "admin":
            raise ValueError("Email is required.")
        email = self.normalize_email(email).strip().lower() if email else None
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"] or extra_fields["role"] != "admin":
            raise ValueError("Superuser must have staff, superuser and admin privileges.")
        extra_fields.setdefault("full_name", username)
        return self.create_user(password=password, username=username, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        VOLUNTEER = "volunteer", "Tình nguyện viên"
        ORGANIZER = "organizer", "Nhà tổ chức"
        ADMIN = "admin", "Quản trị viên"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField("Username", max_length=150, unique=True, null=True, blank=True,
        validators=[RegexValidator(r"^[a-zA-Z0-9_.-]+$", "Username chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.")])
    email = models.EmailField("Email", unique=True, null=True, blank=True)
    full_name = models.CharField("Họ và tên", max_length=150)
    phone = models.CharField("Số điện thoại", max_length=25, blank=True)
    bio = models.TextField("Giới thiệu", max_length=2000, blank=True)
    avatar = models.ImageField("Ảnh đại diện", upload_to="avatars/", blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VOLUNTEER)
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(role__in=["volunteer", "organizer", "admin"]), name="accounts_user_valid_role"),
            models.CheckConstraint(
                condition=(models.Q(role="admin", username__isnull=False) & ~models.Q(username=""))
                | (models.Q(role__in=["volunteer", "organizer"], email__isnull=False, username__isnull=True) & ~models.Q(email="")),
                name="accounts_user_login_identity",
            ),
        ]

    def clean(self):
        super().clean()
        self.email = self.email.strip().lower() if self.email else None
        self.username = self.username.strip().lower() if self.username else None
        if self.role == self.Role.ADMIN:
            if not self.username:
                raise ValidationError({"username": "Admin phải có username."})
        else:
            if not self.email:
                raise ValidationError({"email": "Tài khoản này phải có email."})
            if self.username:
                raise ValidationError({"username": "Username chỉ dành cho Admin."})

    def __str__(self):
        return self.username if self.role == self.Role.ADMIN else self.email


class OrganizerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="organizer_profile")
    organization_name = models.CharField("Tên tổ chức", max_length=200, blank=True)
    description = models.TextField("Mô tả tổ chức", max_length=4000, blank=True)
    website = models.URLField("Website", max_length=300, blank=True)
    contact_address = models.CharField("Địa chỉ liên hệ", max_length=300, blank=True)
