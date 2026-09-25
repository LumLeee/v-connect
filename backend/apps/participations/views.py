from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.activities.views import IsOrganizer
from .models import Participation
from .serializers import ApplicantSerializer, EmptySerializer, ParticipationSerializer, ReviewSerializer
from . import services


class IsVolunteer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'volunteer'


def entries():
    return Participation.objects.select_related('activity', 'activity__organizer', 'activity__organizer__organizer_profile', 'volunteer')


@method_decorator(never_cache, name='dispatch')
class MyList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsVolunteer]
    serializer_class = ParticipationSerializer

    def get_queryset(self):
        return entries().filter(volunteer=self.request.user)


@method_decorator(never_cache, name='dispatch')
class MyParticipation(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def get(self, request, pk):
        get_object_or_404(Activity, pk=pk, published_at__isnull=False)
        entry = entries().filter(activity_id=pk, volunteer=request.user).first()
        return Response({'participation': ParticipationSerializer(entry).data if entry else None})

    def post(self, request, pk):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = services.register(pk, request.user)
        return Response({'participation': ParticipationSerializer(entry).data}, status=201)


@method_decorator(never_cache, name='dispatch')
class CancelParticipation(APIView):
    permission_classes = [IsAuthenticated, IsVolunteer]

    def post(self, request, pk):
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({'participation': ParticipationSerializer(services.cancel(pk, request.user)).data})


@method_decorator(never_cache, name='dispatch')
class ApplicantList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsOrganizer]
    serializer_class = ApplicantSerializer

    def get_queryset(self):
        activity = get_object_or_404(Activity, pk=self.kwargs['pk'], organizer=self.request.user)
        return entries().filter(activity=activity)


@method_decorator(never_cache, name='dispatch')
class ReviewParticipation(APIView):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, pk, entry_id):
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = services.review(pk, entry_id, request.user, serializer.validated_data['status'])
        return Response(ApplicantSerializer(entry).data)
