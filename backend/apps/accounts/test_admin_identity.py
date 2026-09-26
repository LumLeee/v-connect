from io import StringIO
from unittest.mock import patch

from django.contrib.auth import authenticate
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .forms import AccountCreationForm
from .models import User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AdminIdentityTests(APITestCase):
    password = "River-Community-493!"

    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)

    def post(self, endpoint, data):
        token = self.client.get("/api/v1/auth/csrf/").data["csrfToken"]
        return self.client.post(f"/api/v1/auth/{endpoint}/", data, format="json", HTTP_X_CSRFTOKEN=token)

    def test_multiple_admins_need_no_email_and_username_is_normalized(self):
        first = User.objects.create_superuser("Admin.One", self.password)
        second = User.objects.create_superuser("admin.two", self.password)
        self.assertIsNone(first.email)
        self.assertIsNone(second.email)
        self.assertEqual(first.username, "admin.one")
        self.assertEqual(authenticate(username="ADMIN.ONE", password=self.password), first)
        with self.assertRaises(ValidationError):
            User.objects.create_superuser("ADMIN.ONE", self.password)
        for value in ("", "admin@example.com", "has space", "quảntrị"):
            with self.subTest(username=value), self.assertRaises(ValidationError):
                User.objects.create_superuser(value, self.password)

    def test_login_by_username_and_admin_profile_without_email(self):
        user = User.objects.create_superuser("site.admin", self.password)
        response = self.post("login", {"identifier": "SITE.ADMIN", "password": self.password})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["username"], "site.admin")
        self.assertIsNone(response.data["user"]["email"])
        self.assertEqual(self.client.get("/api/v1/auth/profile/").data["profile"]["username"], "site.admin")
        self.assertEqual(self.client.get("/admin/").status_code, 200)
        self.post("logout", {})
        self.assertEqual(self.post("login", {"username": "site.admin", "password": "wrong"}).status_code, 401)
        user.is_active = False
        user.save(update_fields=["is_active"])
        self.assertEqual(self.post("login", {"username": "site.admin", "password": self.password}).status_code, 401)

    def test_admin_email_is_not_a_login_alias_or_reset_target(self):
        user = User.objects.create_superuser("site.admin", self.password, email="old@example.invalid")
        self.assertIsNone(authenticate(email=user.email, password=self.password))
        self.assertEqual(self.post("password-reset", {"email": user.email}).status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        # A reset token issued before the role change must no longer reset an Admin.
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        response = self.post("password-reset/confirm", {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": default_token_generator.make_token(user),
            "password": "New-Safe-Community-843!", "password_confirm": "New-Safe-Community-843!",
        })
        self.assertEqual(response.status_code, 400)

    def test_public_accounts_require_email_and_cannot_supply_username(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(password=self.password, full_name="An")
        with self.assertRaises(ValidationError):
            User.objects.create_user("an@example.invalid", self.password, full_name="An", username="an")
        user = User.objects.create_user("an@example.invalid", self.password, full_name="An")
        self.assertEqual(authenticate(identifier=user.email.upper(), password=self.password), user)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=user.pk).update(email=None)
        self.assertEqual(self.post("login", {"email": user.email, "username": "an", "password": self.password}).status_code, 400)
        self.assertEqual(self.post("register", {"email": "other@example.invalid", "full_name": "Nguyễn An", "role": "volunteer", "username": "admin", "password": self.password, "password_confirm": self.password}).status_code, 400)

    def test_django_admin_creation_form_accepts_username_and_password_only(self):
        form = AccountCreationForm(data={"username": "form.admin", "role": "admin", "password1": self.password, "password2": self.password, "usable_password": "true"})
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertIsNone(user.email)
        self.assertEqual(user.full_name, "form.admin")
        self.assertTrue(user.check_password(self.password))

    def test_django_admin_login_form_accepts_username(self):
        User.objects.create_superuser("panel.admin", self.password)
        page = self.client.get("/admin/login/")
        self.assertEqual(page.status_code, 200)
        response = self.client.post("/admin/login/", {"username": "panel.admin", "password": self.password, "next": "/admin/"}, HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.get("/admin/").status_code, 200)

    def test_create_and_change_admin_password_commands_use_username(self):
        with patch.dict("os.environ", {"DJANGO_SUPERUSER_PASSWORD": self.password}):
            call_command("createsuperuser", username="command.admin", interactive=False, stdout=StringIO())
        user = User.objects.get(username="command.admin")
        self.assertTrue(user.check_password(self.password))
        self.assertIsNone(user.email)
        with patch("django.contrib.auth.management.commands.changepassword.Command._get_pass", return_value="New-Safe-Community-843!"):
            call_command("changepassword", "command.admin", stdout=StringIO())
        user.refresh_from_db()
        self.assertTrue(user.check_password("New-Safe-Community-843!"))
