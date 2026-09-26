from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.activities.serializers import ActivitySerializer
from apps.activities.views import search
from apps.feedback.views import IsAdmin
from apps.participations.serializers import ApplicantSerializer, ParticipationSerializer
from .models import AuditEvent
from .serializers import AccountSerializer, AccountStatusSerializer, AuditSerializer
from . import services


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['organizer', 'admin']


@method_decorator(never_cache, name='dispatch')
class Overview(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = {'role': request.user.role, 'metrics': services.metrics_for(request.user),
                'activities': dict(services.activities_for(request.user).values('status').annotate(total=Count('id')).values_list('status', 'total'))}
        if request.user.role == 'admin':
            data['accounts'] = User.objects.aggregate(total=Count('id'), active=Count('id', filter=Q(is_active=True)), locked=Count('id', filter=Q(is_active=False)))
        return Response(data)


@method_decorator(never_cache, name='dispatch')
class ActivityList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsManager]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        queryset = services.activities_for(self.request.user)
        status = self.request.query_params.get('status')
        if status:
            if status not in ['draft', 'published', 'completed', 'cancelled']:
                raise ValidationError({'status': 'Trạng thái hoạt động không hợp lệ.'})
            queryset = queryset.filter(status=status)
        return search(queryset, self.request)


@method_decorator(never_cache, name='dispatch')
class ActivityResult(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request, pk):
        activity = get_object_or_404(services.activities_for(request.user), pk=pk)
        return Response({'activity': ActivitySerializer(activity).data, 'metrics': services.metrics_for(request.user, activity)})


@method_decorator(never_cache, name='dispatch')
class ParticipationList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return ParticipationSerializer if self.request.user.role == 'volunteer' else ApplicantSerializer

    def get_queryset(self):
        activity = None
        if self.request.query_params.get('activity'):
            from rest_framework import serializers
            pk = serializers.UUIDField().run_validation(self.request.query_params['activity'])
            activity = get_object_or_404(services.activities_for(self.request.user), pk=pk)
        metric = self.request.query_params.get('metric', 'registered')
        if metric not in services.METRICS:
            raise ValidationError({'metric': 'Loại thống kê không hợp lệ.'})
        return services.participations_for(self.request.user, activity).filter(services.METRICS[metric]).select_related(
            'activity__organizer__organizer_profile', 'volunteer', 'attendance__confirmed_by')


@method_decorator(never_cache, name='dispatch')
class AccountList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AccountSerializer

    def get_queryset(self):
        queryset = User.objects.order_by('-date_joined', '-id')
        role = self.request.query_params.get('role')
        status = self.request.query_params.get('status')
        term = self.request.query_params.get('search', '').strip()
        if len(term) > 200:
            raise ValidationError({'search': 'Từ khóa tối đa 200 ký tự.'})
        if role:
            if role not in ['volunteer', 'organizer', 'admin']:
                raise ValidationError({'role': 'Vai trò không hợp lệ.'})
            queryset = queryset.filter(role=role)
        if status:
            if status not in ['active', 'locked']:
                raise ValidationError({'status': 'Trạng thái không hợp lệ.'})
            queryset = queryset.filter(is_active=status == 'active')
        if term:
            queryset = queryset.filter(Q(full_name__icontains=term) | Q(email__icontains=term) | Q(username__icontains=term))
        return queryset


@method_decorator(never_cache, name='dispatch')
class AccountStatus(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        serializer = AccountStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        account = services.set_account_status(request.user, pk, data['is_active'], data['reason'])
        return Response(AccountSerializer(account).data)


@method_decorator(never_cache, name='dispatch')
class AuditList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AuditSerializer

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related('actor', 'subject', 'activity')
        action = self.request.query_params.get('action')
        if action:
            if action not in dict(AuditEvent._meta.get_field('action').choices):
                raise ValidationError({'action': 'Thao tác không hợp lệ.'})
            queryset = queryset.filter(action=action)
        return queryset
