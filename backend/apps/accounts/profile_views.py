from io import BytesIO
import logging
import uuid
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .profile_serializers import ProfileSerializer

logger = logging.getLogger("vconnect.profile")


def delete_avatar(storage, name):
    if name:
        try:
            storage.delete(name)
        except OSError:
            logger.warning("Unable to remove an unused avatar file.")


def normalize_avatar(upload):
    if upload.size > 5 * 1024 * 1024:
        raise ValidationError({"avatar": "Ảnh không được vượt quá 5 MB."})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(upload) as probe:
                if probe.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValidationError({"avatar": "Chỉ nhận ảnh JPEG, PNG hoặc WebP."})
                if probe.width * probe.height > 16_000_000:
                    raise ValidationError({"avatar": "Ảnh không được vượt quá 16 triệu điểm ảnh."})
                probe.verify()
            upload.seek(0)
            with Image.open(upload) as original:
                normalized = ImageOps.exif_transpose(original).convert("RGB")
                normalized.thumbnail((512, 512))
                output = BytesIO()
                # Encode fresh pixels to strip metadata and any appended payload.
                normalized.save(output, format="JPEG", quality=85)
        return ContentFile(output.getvalue())
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValidationError({"avatar": "File ảnh không hợp lệ hoặc bị hỏng."}) from exc


@method_decorator(never_cache, name="dispatch")
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"profile": ProfileSerializer(request.user).data})

    def patch(self, request):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            serializer = ProfileSerializer(user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        # Reload to avoid a stale reverse one-to-one relation after creation.
        return Response({"profile": ProfileSerializer(User.objects.get(pk=user.pk)).data})


@method_decorator(never_cache, name="dispatch")
class AvatarView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        if not request.user.avatar:
            raise NotFound("Bạn chưa có ảnh đại diện.")
        try:
            stream = request.user.avatar.open("rb")
        except FileNotFoundError as exc:
            raise NotFound("Không tìm thấy ảnh đại diện.") from exc
        return FileResponse(stream, content_type="image/jpeg")

    def post(self, request):
        if set(request.data) != {"avatar"} or len(request.FILES.getlist("avatar")) != 1:
            raise ValidationError({"avatar": "Vui lòng chọn đúng một file ảnh."})
        content = normalize_avatar(request.FILES["avatar"])
        new_name = None
        storage = User._meta.get_field("avatar").storage
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                previous = user.avatar.name
                new_name = storage.save(f"avatars/{uuid.uuid4().hex}.jpg", content)
                user.avatar.name = new_name
                user.save(update_fields=["avatar"])
                transaction.on_commit(lambda: delete_avatar(storage, previous))
        except Exception:
            delete_avatar(storage, new_name)
            raise
        return Response({"avatar_url": "/api/v1/auth/profile/avatar/"})

    def delete(self, request):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            previous, storage = user.avatar.name, user.avatar.storage
            user.avatar = ""
            user.save(update_fields=["avatar"])
            transaction.on_commit(lambda: delete_avatar(storage, previous))
        return Response({"avatar_url": None})
