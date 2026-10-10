from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.profile_serializers import StrictFieldsMixin
from apps.activities.serializers import ActivitySerializer
from apps.participations.models import Attendance, Contribution
from .models import Certificate
from .views import IsManager
from .services import activities_for, metrics_for
from .certificate_services import issue_certificate, revoke_certificate


class CertificateSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    activity_id = serializers.UUIDField(source='attendance.participation.activity_id', read_only=True)

    def get_status(self, obj):
        return 'revoked' if obj.revoked_at else 'valid'

    class Meta:
        model = Certificate
        fields = ['id', 'activity_id', 'volunteer_name', 'activity_title', 'organization_name', 'starts_at', 'ends_at',
                  'minutes', 'contribution_revision', 'issued_by_name', 'issued_at', 'status', 'revoked_at', 'revocation_reason']
        read_only_fields = fields


def accessible_certificates(user):
    queryset = Certificate.objects.select_related('attendance__participation')
    if user.role == 'volunteer':
        return queryset.filter(attendance__participation__volunteer=user)
    if user.role == 'organizer':
        return queryset.filter(attendance__participation__activity__organizer=user)
    return queryset if user.role == 'admin' else queryset.none()


class CertificateFilters(serializers.Serializer):
    activity = serializers.UUIDField(required=False)
    status = serializers.ChoiceField(choices=['valid', 'revoked'], required=False)
    search = serializers.CharField(max_length=200, required=False)


@method_decorator(never_cache, name='dispatch')
class CertificateList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CertificateSerializer

    def get_queryset(self):
        form = CertificateFilters(data={k: v for k, v in self.request.query_params.items() if v})
        form.is_valid(raise_exception=True)
        values = form.validated_data
        queryset = accessible_certificates(self.request.user)
        if values.get('activity'):
            queryset = queryset.filter(attendance__participation__activity_id=values['activity'])
        if values.get('status'):
            queryset = queryset.filter(revoked_at__isnull=values['status'] == 'valid')
        if values.get('search'):
            queryset = queryset.filter(Q(volunteer_name__icontains=values['search']) | Q(activity_title__icontains=values['search']))
        return queryset


@method_decorator(never_cache, name='dispatch')
class CertificateDetail(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CertificateSerializer

    def get_queryset(self):
        return accessible_certificates(self.request.user)


class CandidateSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source='participation.volunteer.full_name')
    minutes = serializers.IntegerField(source='contribution.minutes', default=None, read_only=True)
    certificate_id = serializers.UUIDField(source='active_certificate.id', default=None, read_only=True)
    eligible = serializers.SerializerMethodField()

    def get_eligible(self, obj):
        activity = obj.participation.activity
        contribution = getattr(obj, 'contribution', None)
        return bool(activity.status == 'completed' and activity.ends_at <= timezone.now() and contribution and contribution.minutes > 0)

    class Meta:
        model = Attendance
        fields = ['id', 'volunteer_name', 'minutes', 'certificate_id', 'eligible']


@method_decorator(never_cache, name='dispatch')
class CertificateCandidates(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsManager]
    serializer_class = CandidateSerializer

    def get_queryset(self):
        activity = get_object_or_404(activities_for(self.request.user), pk=self.kwargs['pk'])
        return Attendance.objects.filter(participation__activity=activity, participation__status='approved').select_related(
            'participation__volunteer', 'participation__activity', 'contribution', 'active_certificate').order_by('participation__volunteer__full_name', 'id')


class IssueSerializer(StrictFieldsMixin, serializers.Serializer):
    attendance = serializers.UUIDField()


class RevokeSerializer(StrictFieldsMixin, serializers.Serializer):
    reason = serializers.CharField(max_length=1000, allow_blank=False)


@method_decorator(never_cache, name='dispatch')
class IssueCertificate(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def post(self, request, pk):
        form = IssueSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        certificate, created = issue_certificate(request.user, pk, form.validated_data['attendance'])
        return Response(CertificateSerializer(certificate).data, status=201 if created else 200)


@method_decorator(never_cache, name='dispatch')
class RevokeCertificate(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def post(self, request, pk):
        form = RevokeSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        certificate = revoke_certificate(request.user, pk, form.validated_data['reason'])
        return Response(CertificateSerializer(certificate).data)


@method_decorator(never_cache, name='dispatch')
class VerifyCertificate(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        certificate = get_object_or_404(Certificate, pk=pk)
        # Explicit public allowlist: no contact details, user IDs, reason or private activity description.
        response = Response({
            'id': str(certificate.pk), 'volunteer_name': certificate.volunteer_name,
            'activity_title': certificate.activity_title, 'organization_name': certificate.organization_name,
            'minutes': certificate.minutes, 'issued_at': certificate.issued_at,
            'status': 'revoked' if certificate.revoked_at else 'valid', 'revoked_at': certificate.revoked_at,
        })
        response['X-Robots-Tag'] = 'noindex, nofollow'
        return response


@method_decorator(never_cache, name='dispatch')
class ActivitySummaryDocument(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request, pk):
        activity = get_object_or_404(activities_for(request.user).prefetch_related('timeline', 'required_skills'), pk=pk)
        if activity.status != 'completed' or activity.ends_at > timezone.now():
            raise ValidationError('Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành và đã kết thúc.')
        attendance = Attendance.objects.filter(participation__activity=activity, participation__status='approved')
        contributions = Contribution.objects.filter(attendance__in=attendance)
        totals = contributions.aggregate(minutes=Sum('minutes'), confirmed=Count('pk'))
        return Response({
            'activity': ActivitySerializer(activity).data, 'metrics': metrics_for(request.user, activity),
            'contributions': {'minutes': totals['minutes'] or 0, 'confirmed': totals['confirmed'],
                              'pending': attendance.count() - totals['confirmed']},
            'certificates': Certificate.objects.filter(attendance__in=attendance, revoked_at__isnull=True).count(),
            'generated_at': timezone.now(), 'prepared_by': request.user.full_name,
        })
