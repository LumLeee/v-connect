from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from .links import notification_href
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    href = serializers.SerializerMethodField()

    def get_href(self, notification):
        request = self.context.get('request')
        return notification_href(notification, request.user if request else None)

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
        return Notification.objects.filter(recipient=self.request.user).select_related('activity')

    def list(self, request, *args, **kwargs):
        entries = self.filter_queryset(self.get_queryset())
        state = self.request.query_params.get('state', 'all')
        if state not in ['all', 'unread', 'read']:
            raise ValidationError({'state': 'Bộ lọc không hợp lệ.'})
        summary = entries.aggregate(total=Count('pk'), unread=Count('pk', filter=Q(read_at__isnull=True)))
        summary['read'] = summary['total'] - summary['unread']
        if state != 'all':
            entries = entries.filter(read_at__isnull=state == 'unread')
        page = self.paginate_queryset(entries)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
            response.data['summary'] = summary
            return response
        return Response({'count': entries.count(), 'results': self.get_serializer(entries, many=True).data,
                         'summary': summary})


@method_decorator(never_cache, name='dispatch')
class UnreadCount(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = Notification.objects.filter(recipient=request.user)
        latest = entries.order_by('-created_at', '-id').values('id', 'created_at').first()
        return Response({'count': entries.filter(read_at__isnull=True).count(),
                         'latest_id': str(latest['id']) if latest else None})


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
