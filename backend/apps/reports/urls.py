from django.urls import path
from .views import Overview, ActivityList, ActivityResult, ParticipationList, AccountList, AccountStatus, AuditList, VolunteerDashboard

urlpatterns = [
    path('reports/volunteer-dashboard/', VolunteerDashboard.as_view()),
    path('reports/overview/', Overview.as_view()),
    path('reports/activities/', ActivityList.as_view()),
    path('reports/activities/<uuid:pk>/', ActivityResult.as_view()),
    path('reports/participations/', ParticipationList.as_view()),
    path('admin/accounts/', AccountList.as_view()),
    path('admin/accounts/<uuid:pk>/status/', AccountStatus.as_view()),
    path('admin/audit/', AuditList.as_view()),
]
