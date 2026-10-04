from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'kind', 'title', 'body', 'href', 'created_at', 'read_at']


class EmptySerializer(StrictFieldsMixin, serializers.Serializer):
    pass


class PreferenceSerializer(StrictFieldsMixin, serializers.Serializer):
    email_enabled = serializers.BooleanField()

    def validate_email_enabled(self, value):
        if type(self.initial_data.get('email_enabled')) is not bool:
            raise serializers.ValidationError('Giá trị phải là true hoặc false.')
        return value


@method_decorator(never_cache, name='dispatch')
class NotificationList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        entries = Notification.objects.filter(recipient=self.request.user)
        state = self.request.query_params.get('state', 'all')
        if state not in ['all', 'unread', 'read']:
            raise ValidationError({'state': 'Bộ lọc không hợp lệ.'})
        return entries if state == 'all' else entries.filter(read_at__isnull=state == 'unread')


@method_decorator(never_cache, name='dispatch')
class UnreadCount(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'count': Notification.objects.filter(recipient=request.user, read_at__isnull=True).count()})


@method_decorator(never_cache, name='dispatch')
class MarkRead(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        payload = EmptySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        entries = Notification.objects.filter(recipient=request.user)
        if pk is not None:
            get_object_or_404(entries, pk=pk)
            entries = entries.filter(pk=pk)
        count = entries.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({'updated': count})


@method_decorator(never_cache, name='dispatch')
class Preferences(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        item = NotificationPreference.objects.filter(user=request.user).first()
        return Response({'email_enabled': item.email_enabled if item else True, 'email_available': bool(request.user.email)})

    def patch(self, request):
        payload = PreferenceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        NotificationPreference.objects.update_or_create(user=request.user, defaults=payload.validated_data)
        return self.get(request)
