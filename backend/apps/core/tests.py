from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.db import OperationalError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.models import User
from .models import Skill


class FoundationAPITests(APITestCase):
    def test_health_reports_database_and_migrations(self):
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["database"], "connected")
        self.assertEqual(response.data["migrations"], "applied")
        self.assertIn("X-Request-ID", response)

    def test_health_returns_503_without_leaking_connection_error(self):
        with patch("apps.core.views.connection.cursor", side_effect=OperationalError("private connection info")):
            response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["database"], "unavailable")
        self.assertNotIn("private connection info", str(response.data))

    def test_health_detects_pending_migrations(self):
        with patch("apps.core.views.MigrationExecutor") as executor:
            executor.return_value.migration_plan.return_value = [object()]
            response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["migrations"], "pending")

    def test_public_catalog_pagination_and_vietnamese_roundtrip(self):
        Skill.objects.create(name="Sơ cứu 🩹", slug="so-cuu")
        Skill.objects.create(name="Giảng dạy", slug="giang-day")
        response = self.client.get("/api/v1/skills/?page_size=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIsNotNone(response.data["next"])
        second = self.client.get("/api/v1/skills/?page_size=1&page=2")
        self.assertEqual(second.data["results"][0]["name"], "Sơ cứu 🩹")

    def test_catalog_is_read_only(self):
        response = self.client.post("/api/v1/skills/", {"name": "Injected", "slug": "injected"})
        self.assertEqual(response.status_code, 405)
        self.assertIn("error", response.data)
        self.assertFalse(Skill.objects.exists())

    def test_unknown_api_path_returns_json(self):
        response = self.client.get("/api/v1/does-not-exist/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


class FoundationDataTests(TestCase):
    def test_seed_is_repeatable_and_preserves_edits(self):
        call_command("seed_data", stdout=StringIO())
        Skill.objects.filter(slug="so-cuu").update(name="Sơ cứu cơ bản")
        call_command("seed_data", stdout=StringIO())
        self.assertEqual(Skill.objects.count(), 8)
        self.assertEqual(Skill.objects.get(slug="so-cuu").name, "Sơ cứu cơ bản")

    def test_custom_user_stores_hashed_password_and_normalizes_email(self):
        user = User.objects.create_user("Volunteer@Example.COM", "Example-password-123!", full_name="Nguyễn An")
        self.assertEqual(user.email, "volunteer@example.com")
        self.assertEqual(user.role, "volunteer")
        self.assertTrue(user.check_password("Example-password-123!"))
        self.assertNotEqual(user.password, "Example-password-123!")

    def test_superuser_has_admin_role(self):
        user = User.objects.create_superuser("admin@example.com", "Example-password-123!", full_name="Quản trị")
        self.assertTrue(user.is_staff and user.is_superuser)
        self.assertEqual(user.role, "admin")
