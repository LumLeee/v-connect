from django.urls import path
from .views import Overview, ActivityList, ActivityResult, ParticipationList, AccountList, AccountStatus, AuditList, VolunteerDashboard
from .analytics_views import Analytics, ExportAnalytics, ReportOrganizers
from .organizer_dashboard import OrganizerDashboard

urlpatterns = [
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
]
