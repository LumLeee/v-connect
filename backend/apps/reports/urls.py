from django.urls import path
from .views import Overview, ActivityList, ActivityResult, ParticipationList, AccountList, AccountStatus, AuditList, AuditDetail, VolunteerDashboard
from .analytics_views import Analytics, ExportAnalytics, ReportOrganizers
from .organizer_dashboard import OrganizerDashboard
from .matching import RecommendedActivities, RecommendedVolunteers
from .certificate_views import (CertificateList, CertificateDetail, CertificateCandidates, IssueCertificate,
                                RevokeCertificate, VerifyCertificate, ActivitySummaryDocument)

urlpatterns = [
    path('certificates/', CertificateList.as_view()),
    path('certificates/<uuid:pk>/', CertificateDetail.as_view()),
    path('certificates/<uuid:pk>/revoke/', RevokeCertificate.as_view()),
    path('certificates/<uuid:pk>/verify/', VerifyCertificate.as_view()),
    path('reports/activities/<uuid:pk>/certificate-candidates/', CertificateCandidates.as_view()),
    path('reports/activities/<uuid:pk>/certificates/', IssueCertificate.as_view()),
    path('reports/activities/<uuid:pk>/summary-document/', ActivitySummaryDocument.as_view()),
    path('matching/activities/', RecommendedActivities.as_view()),
    path('organizer/activities/<uuid:pk>/matching/', RecommendedVolunteers.as_view()),
    path('reports/organizer-dashboard/', OrganizerDashboard.as_view()),
    path('reports/analytics/', Analytics.as_view()),
    path('reports/analytics/export/', ExportAnalytics.as_view()),
    path('reports/organizers/', ReportOrganizers.as_view()),
    path('reports/volunteer-dashboard/', VolunteerDashboard.as_view()),
    path('reports/overview/', Overview.as_view()),
    path('reports/activities/', ActivityList.as_view()),
    path('reports/activities/<uuid:pk>/', ActivityResult.as_view()),
    path('reports/participations/', ParticipationList.as_view()),
    path('admin/accounts/', AccountList.as_view()),
    path('admin/accounts/<uuid:pk>/status/', AccountStatus.as_view()),
    path('admin/audit/', AuditList.as_view()),
    path('admin/audit/<uuid:pk>/', AuditDetail.as_view()),
]
