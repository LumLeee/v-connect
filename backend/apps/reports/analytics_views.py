from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.feedback.views import IsAdmin
from .analytics import build_report, organizer_name
from .exports import report_workbook
from .views import IsManager


@method_decorator(never_cache, name='dispatch')
class Analytics(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request):
        return Response(build_report(request.user, request.query_params))


@method_decorator(never_cache, name='dispatch')
class ExportAnalytics(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request):
        report = build_report(request.user, request.query_params)
        response = HttpResponse(report_workbook(report), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="v-connect-bao-cao.xlsx"'
        return response


class OrganizerOptionSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'name', 'is_active']

    def get_name(self, user):
        return organizer_name(user)


@method_decorator(never_cache, name='dispatch')
class ReportOrganizers(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = OrganizerOptionSerializer
    queryset = User.objects.filter(role='organizer').select_related('organizer_profile').order_by('full_name', 'id')
