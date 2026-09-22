from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .models import OrganizerProfile, User


class ProfileTests(APITestCase):
    url = "/api/v1/auth/profile/"
    avatar_url = "/api/v1/auth/profile/avatar/"

    def setUp(self):
        cache.clear()
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.media = Path(directory.name)
        settings = override_settings(MEDIA_ROOT=directory.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.user = User.objects.create_user("profile@example.invalid", "River-Community-493!", full_name="Nguyễn An")
        self.organizer = User.objects.create_user("org@example.invalid", "River-Community-493!", full_name="Nguyễn Bình", role="organizer")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)

    def headers(self):
        token = self.client.get("/api/v1/auth/csrf/").data["csrfToken"]
        return {"HTTP_X_CSRFTOKEN": token}

    def update(self, payload):
        return self.client.patch(self.url, payload, format="json", **self.headers())

    def image(self, color="red"):
        stream = BytesIO()
        Image.new("RGB", (800, 600), color).save(stream, format="PNG")
        return SimpleUploadedFile("../../untrusted.png", stream.getvalue(), content_type="image/png")

    def upload(self, image=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.avatar_url, {"avatar": image or self.image()}, format="multipart", **self.headers())

    def test_access_requires_session_and_csrf(self):
        self.assertEqual(self.client.patch(self.url, {"bio": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.post(self.avatar_url, {"avatar": self.image()}, format="multipart").status_code, 403)
        self.assertEqual(self.client.delete(self.avatar_url).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.get(self.avatar_url).status_code, 401)

    def test_basic_profile_persists_and_only_current_user_is_accessible(self):
        result = self.update({"full_name": "Nguyễn An Mới", "phone": "+84 912 345 678", "bio": "Yêu hoạt động cộng đồng 🌱"})
        self.assertEqual(result.status_code, 200)
        profile = self.client.get(f"{self.url}?user_id={self.organizer.pk}").data["profile"]
        self.assertEqual(profile["id"], str(self.user.pk))
        self.assertEqual(profile["bio"], "Yêu hoạt động cộng đồng 🌱")
        self.assertNotIn("password", profile)
        self.assertEqual(self.client.get("/api/v1/auth/me/").data["user"]["full_name"], "Nguyễn An Mới")
        self.organizer.refresh_from_db()
        self.assertEqual(self.organizer.full_name, "Nguyễn Bình")

    def test_privileged_or_foreign_fields_are_rejected_without_partial_write(self):
        for field, value in {"id": str(self.organizer.pk), "user_id": str(self.organizer.pk), "email": "other@example.invalid", "role": "admin", "is_staff": True, "avatar": "other.jpg", "password": "abc"}.items():
            with self.subTest(field=field):
                self.assertEqual(self.update({"full_name": "Không được lưu", field: value}).status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Nguyễn An")

    def test_validation_and_optional_fields_can_be_cleared(self):
        for payload in ({"full_name": " "}, {"phone": "abc"}, {"phone": "123"}, {"phone": "1" * 16}, {"bio": "x" * 2001}, {"organizer": None}):
            self.assertEqual(self.update(payload).status_code, 400)
        self.assertEqual(self.update({"phone": "0912345678", "bio": "Xin chào"}).status_code, 200)
        result = self.update({"phone": "", "bio": ""})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["profile"]["phone"], "")

    def test_volunteer_cannot_create_organization(self):
        self.assertEqual(self.update({"organizer": {"organization_name": "Tổ chức giả"}}).status_code, 400)
        self.assertFalse(OrganizerProfile.objects.exists())

    def test_organizer_profile_create_partial_update_and_validation(self):
        self.client.force_login(self.organizer)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        organization = {"organization_name": "Nhóm Xanh", "description": "Hoạt động cộng đồng", "website": "https://example.org", "contact_address": "Đà Nẵng"}
        result = self.update({"organizer": organization})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["profile"]["organizer"], organization)
        result = self.update({"organizer": {"description": "Mô tả mới"}})
        self.assertEqual(result.data["profile"]["organizer"]["organization_name"], "Nhóm Xanh")
        for data in ({"website": "javascript:alert(1)"}, {"website": "ftp://example.org"}, {"user": str(self.user.pk)}, {"organization_name": "x" * 201}):
            self.assertEqual(self.update({"full_name": "Không được lưu", "organizer": data}).status_code, 400)
        self.organizer.refresh_from_db()
        self.assertEqual(self.organizer.full_name, "Nguyễn Bình")
        self.assertEqual(OrganizerProfile.objects.filter(user=self.organizer).count(), 1)

    def test_avatar_is_reencoded_resized_private_replaced_and_deleted(self):
        self.assertEqual(self.upload().status_code, 200)
        self.user.refresh_from_db()
        previous = self.user.avatar.name
        with Image.open(self.user.avatar.path) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (512, 384))
        response = self.client.get(self.avatar_url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])
        self.assertTrue(b"".join(response.streaming_content).startswith(b"\xff\xd8"))
        self.client.force_login(self.organizer)
        self.assertEqual(self.client.get(f"{self.avatar_url}?user_id={self.user.pk}").status_code, 404)
        self.client.force_login(self.user)
        self.assertEqual(self.upload(self.image("blue")).status_code, 200)
        self.assertFalse((self.media / previous).exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(self.avatar_url, **self.headers()).status_code, 200)
        self.assertEqual(self.client.get(self.avatar_url).status_code, 404)
        self.assertFalse(list(self.media.rglob("*.jpg")))

    def test_fake_oversized_and_excess_pixel_images_are_rejected(self):
        fake = SimpleUploadedFile("fake.jpg", b"<script>not an image</script>", content_type="image/jpeg")
        big = SimpleUploadedFile("big.png", b"0" * (5 * 1024 * 1024 + 1), content_type="image/png")
        stream = BytesIO()
        Image.new("RGB", (4001, 4000)).save(stream, format="PNG")
        excessive = SimpleUploadedFile("pixels.png", stream.getvalue(), content_type="image/png")
        for image in (fake, big, excessive):
            self.assertEqual(self.upload(image).status_code, 400)
        self.assertFalse(list(self.media.rglob("*.jpg")))

    def test_avatar_file_is_removed_if_database_save_fails(self):
        with patch.object(User, "save", side_effect=RuntimeError("Simulated database failure")):
            self.assertEqual(self.upload().status_code, 500)
        self.assertFalse(list(self.media.rglob("*.jpg")))
