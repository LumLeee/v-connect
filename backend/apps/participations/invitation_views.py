from django.db.models import Count, Q
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
from apps.activities.models import Activity
from apps.activities.time_policy import enabled
from apps.activities.views import IsOrganizer
from . import invitations
from .models import Invitation, Participation
from .serializers import EmptySerializer
from .views import IsVolunteer


class SendSerializer(StrictFieldsMixin, serializers.Serializer):
    volunteer = serializers.UUIDField()
    message = serializers.CharField(max_length=1000, allow_blank=True, default='')


class ResponseSerializer(StrictFieldsMixin, serializers.Serializer):
    status = serializers.ChoiceField(choices=['accepted', 'declined'])


class InvitationSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source='volunteer.full_name', read_only=True)
    organizer_name = serializers.CharField(source='activity.organizer.full_name', read_only=True)
    activity = serializers.SerializerMethodField()
    unavailable_reason = serializers.SerializerMethodField()
    activity_changed = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ['id', 'activity', 'volunteer', 'volunteer_name', 'organizer_name', 'message', 'status',
                  'created_at', 'responded_at', 'unavailable_reason', 'activity_changed']
        read_only_fields = fields

    def get_activity(self, obj):
        a = obj.activity
        return {'id': str(a.pk), 'title': a.title, 'starts_at': a.starts_at, 'ends_at': a.ends_at,
                'address': a.address, 'status': a.status}

    def get_activity_changed(self, obj):
        a = obj.activity
        return (a.starts_at != obj.invited_starts_at or a.ends_at != obj.invited_ends_at or a.address != obj.invited_address)

    def get_unavailable_reason(self, obj):
        if obj.status != 'pending':
            return ''
        a = obj.activity
        if a.status != 'published' or not a.published_at:
            return 'Hoạt động không còn mở đăng ký.'
        if enabled() and a.starts_at <= timezone.now():
            return 'Đã hết hạn xác nhận lời mời.'
        if not a.organizer.is_active or not obj.volunteer.is_active:
            return 'Tài khoản không còn khả dụng.'
        entry = Participation.objects.filter(activity=a, volunteer=obj.volunteer).first()
        if entry and not (entry.status == 'pending' or
                          (entry.status == 'cancelled' and entry.cancellation_reason == 'volunteer')):
            return 'Đăng ký đã được duyệt hoặc không còn đủ điều kiện đăng ký lại.'
        if a.participations.filter(status='approved').count() >= a.capacity:
            return 'Hoạt động hiện đã đủ chỗ. Lời mời không giữ chỗ.'
        return ''


def entries():
    return Invitation.objects.select_related('activity', 'activity__organizer', 'volunteer')


@method_decorator(never_cache, name='dispatch')
class MyInvitations(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsVolunteer]
    serializer_class = InvitationSerializer

    def get_queryset(self):
        self.invitation_status = self.request.query_params.get('status', 'all').strip()
        if self.invitation_status not in ['all', *Invitation.Status.values]:
            raise ValidationError({'status': 'Trạng thái lời mời không hợp lệ.'})
        term = self.request.query_params.get('search', '').strip()
        if len(term) > 200:
            raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})
        queryset = entries().filter(volunteer=self.request.user)
        if term:
            queryset = queryset.filter(Q(activity__title__icontains=term) | Q(activity__organizer__full_name__icontains=term))
        return queryset.order_by('-created_at', '-pk')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = queryset.aggregate(total=Count('pk'), **{
            status: Count('pk', filter=Q(status=status)) for status in Invitation.Status.values
        })
        if self.invitation_status != 'all':
            queryset = queryset.filter(status=self.invitation_status)
        page = self.paginate_queryset(queryset)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        else:
            results = self.get_serializer(queryset, many=True).data
            response = Response({'count': len(results), 'next': None, 'previous': None, 'results': results})
        response.data['summary'] = summary
        return response


@method_decorator(never_cache, name='dispatch')
class ManagedInvitations(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = InvitationSerializer

    def get_queryset(self):
        activity = get_object_or_404(Activity, pk=self.kwargs['pk'], organizer=self.request.user)
        self.invitation_status = self.request.query_params.get('status', 'all').strip()
        if self.invitation_status not in ['all', *Invitation.Status.values]:
            raise ValidationError({'status': 'Trạng thái lời mời không hợp lệ.'})
        term = self.request.query_params.get('search', '').strip()
        if len(term) > 200:
            raise ValidationError({'search': 'Từ khóa không được vượt quá 200 ký tự.'})
        queryset = entries().filter(activity=activity)
        if term:
            queryset = queryset.filter(volunteer__full_name__icontains=term)
        return queryset.order_by('-created_at', '-pk')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = queryset.aggregate(total=Count('pk'), **{
            status: Count('pk', filter=Q(status=status)) for status in Invitation.Status.values
        })
        if self.invitation_status != 'all':
            queryset = queryset.filter(status=self.invitation_status)
        page = self.paginate_queryset(queryset)
        if page is not None:
            response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        else:
            results = self.get_serializer(queryset, many=True).data
            response = Response({'count': len(results), 'next': None, 'previous': None, 'results': results})
        response.data['summary'] = summary
        return response

    def post(self, request, pk):
        serializer = SendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item, created = invitations.send(pk, request.user, serializer.validated_data['volunteer'], serializer.validated_data['message'])
        return Response(InvitationSerializer(item).data, status=201 if created else 200)


@method_decorator(never_cache, name='dispatch')
class RespondInvitation(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def post(self, request, pk):
        serializer = ResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = invitations.respond(pk, request.user, serializer.validated_data['status'])
        return Response(InvitationSerializer(item).data)


@method_decorator(never_cache, name='dispatch')
class WithdrawInvitation(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk, invitation_id):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = invitations.withdraw(pk, invitation_id, request.user)
        return Response(InvitationSerializer(item).data)
