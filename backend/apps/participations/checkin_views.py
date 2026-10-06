from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.activities.models import Activity
from apps.activities.views import IsOrganizer
from . import checkin
from .serializers import AttendanceSerializer, EmptySerializer
from .views import IsVolunteer


class CheckInSerializer(StrictFieldsMixin, serializers.Serializer):
    code = serializers.RegexField(r'^[0-9]{8}$', required=False, max_length=8)
    token = serializers.RegexField(r'^[a-f0-9]{64}$', required=False, max_length=64)

    def validate(self, attrs):
        if len(attrs) != 1:
            raise serializers.ValidationError('Cung cấp đúng một mã nhập hoặc mã QR.')
        return attrs


class CheckInThrottle(UserRateThrottle):
    scope = 'attendance_checkin'
    rate = '6/minute'


@method_decorator(never_cache, name='dispatch')
class ManageAttendanceCode(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, pk):
        activity = get_object_or_404(Activity, pk=pk, organizer=request.user)
        return Response(checkin.session_data(activity))

    def post(self, request, pk):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(checkin.issue(pk, request.user), status=201)


@method_decorator(never_cache, name='dispatch')
class RevokeAttendanceCode(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(checkin.revoke(pk, request.user))


@method_decorator(never_cache, name='dispatch')
class SelfCheckIn(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]
    throttle_classes = [CheckInThrottle]

    def post(self, request, pk):
        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attendance, created = checkin.check_in(pk, request.user, serializer.validated_data)
        return Response(AttendanceSerializer(attendance).data, status=201 if created else 200)
