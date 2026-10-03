from io import BytesIO
import logging
import uuid
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Activity
from .serializers import ActivitySerializer
from .views import IsOrganizer

logger = logging.getLogger('vconnect.activities')


def remove_cover(storage, name):
    if name:
        try:
            storage.delete(name)
        except OSError:
            logger.warning('Unable to remove an unused activity cover.')


def normalize_cover(upload):
    if upload.size > 5 * 1024 * 1024:
        raise ValidationError({'cover': 'Ảnh không được vượt quá 5 MB.'})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(upload) as probe:
                if probe.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise ValidationError({'cover': 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.'})
                if probe.width * probe.height > 16_000_000:
                    raise ValidationError({'cover': 'Ảnh không được vượt quá 16 triệu điểm ảnh.'})
                probe.verify()
            upload.seek(0)
            with Image.open(upload) as original:
                normalized = ImageOps.exif_transpose(original).convert('RGB')
                normalized.thumbnail((1920, 1920))
                output = BytesIO()
                normalized.save(output, format='JPEG', quality=85)
        return ContentFile(output.getvalue())
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValidationError({'cover': 'File ảnh không hợp lệ hoặc bị hỏng.'}) from exc


@method_decorator(never_cache, name='dispatch')
class ActivityCover(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        return [AllowAny()] if self.request.method in ['GET', 'HEAD', 'OPTIONS'] else [IsAuthenticated(), IsOrganizer()]

    def get(self, request, pk):
        visible = Q(published_at__isnull=False, status__in=['published', 'completed', 'cancelled'])
        if request.user.is_authenticated and request.user.role == 'organizer':
            visible |= Q(organizer=request.user)
        activity = get_object_or_404(Activity.objects.filter(visible), pk=pk)
        if not activity.cover:
            raise NotFound('Hoạt động chưa có ảnh bìa.')
        try:
            stream = activity.cover.open('rb')
        except FileNotFoundError as exc:
            raise NotFound('Không tìm thấy ảnh bìa.') from exc
        return FileResponse(stream, content_type='image/jpeg')

    def editable(self, request, pk):
        activity = get_object_or_404(Activity.objects.select_for_update(), pk=pk, organizer=request.user)
        if activity.status not in ['draft', 'published']:
            raise ValidationError('Không thể sửa ảnh hoạt động đã hoàn thành hoặc đã hủy.')
        return activity

    def post(self, request, pk):
        if set(request.data) != {'cover'} or len(request.FILES.getlist('cover')) != 1:
            raise ValidationError({'cover': 'Vui lòng chọn đúng một file ảnh.'})
        storage = Activity._meta.get_field('cover').storage
        new_name = None
        try:
            with transaction.atomic():
                activity = self.editable(request, pk)
                content = normalize_cover(request.FILES['cover'])
                previous = activity.cover.name
                new_name = storage.save(f'activities/covers/{uuid.uuid4().hex}.jpg', content)
                activity.cover.name = new_name
                activity.save(update_fields=['cover', 'updated_at'])
                transaction.on_commit(lambda: remove_cover(storage, previous))
        except Exception:
            remove_cover(storage, new_name)
            raise
        return Response({'cover_url': ActivitySerializer(activity).data['cover_url']})

    def delete(self, request, pk):
        with transaction.atomic():
            activity = self.editable(request, pk)
            previous, storage = activity.cover.name, activity.cover.storage
            activity.cover = ''
            activity.save(update_fields=['cover', 'updated_at'])
            transaction.on_commit(lambda: remove_cover(storage, previous))
        return Response({'cover_url': None})
