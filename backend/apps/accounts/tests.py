from datetime import datetime, timedelta
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.core.exceptions import ValidationError as DjangoValidationError
from io import StringIO
from django.test import override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient, APITestCase

from .models import User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthTests(APITestCase):
    password = "River-Community-493!"

    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)

    def post(self, endpoint, data=None, client=None):
        client = client or self.client
        token = client.get("/api/v1/auth/csrf/").data["csrfToken"]
        return client.post(f"/api/v1/auth/{endpoint}/", data or {}, format="json", HTTP_X_CSRFTOKEN=token)

    def make_user(self, role="volunteer", **kwargs):
        if role == "admin":
            return User.objects.create_superuser("admin", self.password, full_name="Nguyễn An", **kwargs)
        return User.objects.create_user(f"{role}@example.com", self.password, full_name="Nguyễn An", role=role, **kwargs)

    def register(self, **overrides):
        return self.post("register", {"email": "An@Example.com", "full_name": "Nguyễn An", "role": "volunteer", "password": self.password, "password_confirm": self.password, **overrides})

    def login(self, user, **overrides):
        key = "username" if user.role == "admin" else "email"
        return self.post("login", {key: getattr(user, key), "password": self.password, **overrides})

    def test_both_public_roles_can_register_and_get_private_session(self):
        for role in ("volunteer", "organizer"):
            response = self.register(email=f"{role}@example.com", role=role)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data["user"]["role"], role)
            self.assertTrue(response.cookies["sessionid"]["httponly"])
            self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 200)
            self.assertEqual(self.client.get(f"/api/v1/auth/workspace/{role}/").status_code, 200)
            self.post("logout")

    def test_registration_rejects_admin_and_privileged_extra_fields(self):
        self.assertEqual(self.register(role="admin").status_code, 400)
        self.assertEqual(self.register(is_staff=True).status_code, 400)
        self.assertEqual(self.register(is_superuser=True).status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_registration_handles_uniqueness_validation_race(self):
        with patch.object(User.objects, "create_user", side_effect=DjangoValidationError({"email": "Duplicate email"})):
            response = self.register()
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data["error"]["details"])

    def test_password_cannot_match_full_name(self):
        self.assertEqual(self.register(full_name="CommunityVolunteer", password="CommunityVolunteer", password_confirm="CommunityVolunteer").status_code, 400)

    def test_me_only_returns_current_user_even_with_other_user_id(self):
        current = self.make_user()
        other = self.make_user("organizer")
        self.login(current)
        response = self.client.get(f"/api/v1/auth/me/?user_id={other.pk}")
        self.assertEqual(response.data["user"]["id"], str(current.pk))

    def test_admin_creation_command(self):
        call_command("createsuperuser", username="admin-command", interactive=False, stdout=StringIO())
        user = User.objects.get(username="admin-command")
        self.assertIsNone(user.email)
        self.assertEqual(user.full_name, "admin-command")
        self.assertTrue(user.is_staff and user.is_superuser)
        self.assertEqual(user.role, "admin")

    def test_registration_validates_duplicate_email_password_and_name(self):
        self.assertEqual(self.register(password="123", password_confirm="123").status_code, 400)
        self.assertEqual(self.register(password_confirm="different").status_code, 400)
        self.assertEqual(self.register(full_name=" ").status_code, 400)
        self.assertEqual(self.register().status_code, 201)
        self.assertEqual(self.register(email="AN@EXAMPLE.COM").status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_login_csrf_is_required_even_before_authentication(self):
        user = self.make_user()
        response = self.client.post("/api/v1/auth/login/", {"email": user.email, "password": self.password})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)

    def test_other_mutations_require_csrf(self):
        for endpoint in ("register", "logout", "password-reset", "password-reset/confirm"):
            self.assertEqual(self.client.post(f"/api/v1/auth/{endpoint}/", {}, format="json").status_code, 403)

    def test_untrusted_origin_is_rejected(self):
        user = self.make_user()
        token = self.client.get("/api/v1/auth/csrf/").data["csrfToken"]
        response = self.client.post("/api/v1/auth/login/", {"email": user.email, "password": self.password}, HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://attacker.example")
        self.assertEqual(response.status_code, 403)

    def test_wrong_password_and_banned_account_do_not_login(self):
        user = self.make_user()
        self.assertEqual(self.login(user, password="incorrect").status_code, 401)
        user.is_active = False
        user.save()
        self.assertEqual(self.login(user).status_code, 401)

    def test_login_normalizes_email_and_remember_expiry(self):
        user = self.make_user()
        response = self.login(user, email=user.email.upper(), remember=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies["sessionid"]["max-age"], 1209600)
        self.post("logout")
        response = self.login(user, remember=False)
        self.assertEqual(response.cookies["sessionid"]["max-age"], "")

    def test_logout_invalidates_server_session_and_me_has_no_password(self):
        user = self.make_user()
        self.login(user)
        session_key = self.client.cookies["sessionid"].value
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(set(response.data["user"]), {"id", "email", "username", "full_name", "role"})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(self.post("logout").status_code, 200)
        self.assertFalse(Session.objects.filter(session_key=session_key).exists())
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)

    def test_banning_user_revokes_access_for_existing_session(self):
        user = self.make_user()
        self.login(user)
        User.objects.filter(pk=user.pk).update(is_active=False)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)

    def test_expired_session_is_rejected(self):
        self.login(self.make_user())
        Session.objects.update(expire_date=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)

    def test_workspace_role_matrix_and_live_role_changes(self):
        for role in ("volunteer", "organizer", "admin"):
            user = self.make_user(role)
            self.login(user)
            for target in ("volunteer", "organizer", "admin"):
                response = self.client.get(f"/api/v1/auth/workspace/{target}/")
                self.assertEqual(response.status_code, 200 if role == target else 403)
            self.post("logout")
        user = User.objects.get(role="volunteer")
        self.login(user)
        User.objects.filter(pk=user.pk).update(role="organizer")
        self.assertEqual(self.client.get("/api/v1/auth/workspace/volunteer/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/auth/workspace/organizer/").status_code, 200)

    def test_me_cannot_be_updated_to_escalate_role(self):
        self.login(self.make_user())
        self.assertEqual(self.post("me", {"role": "admin"}).status_code, 405)
        self.assertEqual(User.objects.get().role, "volunteer")

    def test_reset_does_not_disclose_account_existence_and_uses_configured_origin(self):
        user = self.make_user()
        known = self.post("password-reset", {"email": user.email})
        unknown = self.post("password-reset", {"email": "missing@example.com"})
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("http://127.0.0.1:5173/dat-lai-mat-khau/", mail.outbox[0].body)
        self.assertNotIn("token", known.data)

    def reset_payload(self, user, token=None):
        user.refresh_from_db()
        return {"uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": token or default_token_generator.make_token(user), "password": "New-Safe-Community-843!", "password_confirm": "New-Safe-Community-843!"}

    def test_reset_changes_password_invalidates_old_sessions_and_token_replay(self):
        user = self.make_user()
        self.login(user)
        guest = APIClient(enforce_csrf_checks=True)
        data = self.reset_payload(user)
        self.assertEqual(self.post("password-reset/confirm", data, guest).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)
        self.assertEqual(self.post("password-reset/confirm", data, guest).status_code, 400)
        self.assertEqual(self.login(user).status_code, 401)
        self.assertEqual(self.login(user, password=data["password"]).status_code, 200)

    def test_reset_rejects_invalid_uid_expired_token_and_weak_password(self):
        user = self.make_user()
        data = self.reset_payload(user)
        self.assertEqual(self.post("password-reset/confirm", {**data, "uid": "not-a-uuid"}).status_code, 400)
        self.assertEqual(self.post("password-reset/confirm", {**data, "password": "123", "password_confirm": "123"}).status_code, 400)
        with patch.object(default_token_generator, "_now", return_value=datetime.now() - timedelta(hours=2)):
            token = default_token_generator.make_token(user)
        self.assertEqual(self.post("password-reset/confirm", self.reset_payload(user, token)).status_code, 400)

    def test_password_reset_is_rate_limited(self):
        for _ in range(5):
            self.assertEqual(self.post("password-reset", {"email": "missing@example.com"}).status_code, 200)
        self.assertEqual(self.post("password-reset", {"email": "missing@example.com"}).status_code, 429)

    def test_reset_does_not_send_mail_for_inactive_user(self):
        user = self.make_user(is_active=False)
        self.assertEqual(self.post("password-reset", {"email": user.email}).status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
