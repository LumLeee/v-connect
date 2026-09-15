import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email).strip().lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"] or extra_fields["role"] != "admin":
            raise ValueError("Superuser must have staff, superuser and admin privileges.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        VOLUNTEER = "volunteer", "Tình nguyện viên"
        ORGANIZER = "organizer", "Nhà tổ chức"
        ADMIN = "admin", "Quản trị viên"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField("Email", unique=True)
    full_name = models.CharField("Họ và tên", max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VOLUNTEER)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(role__in=["volunteer", "organizer", "admin"]), name="accounts_user_valid_role")]

    def __str__(self):
        return self.email
