from django.urls import path
from .views import MyList, MyHistory, MyParticipation, CancelParticipation, ApplicantList, ReviewParticipation, AttendanceList, ConfirmAttendance
from .checkin_views import ManageAttendanceCode, RevokeAttendanceCode, SelfCheckIn

urlpatterns = [
    path('organizer/activities/<uuid:pk>/attendance-code/', ManageAttendanceCode.as_view()),
    path('organizer/activities/<uuid:pk>/attendance-code/revoke/', RevokeAttendanceCode.as_view()),
    path('activities/<uuid:pk>/check-in/', SelfCheckIn.as_view()),
    path('participations/', MyList.as_view()),
    path('participations/history/', MyHistory.as_view()),
    path('activities/<uuid:pk>/participation/', MyParticipation.as_view()),
    path('activities/<uuid:pk>/participation/cancel/', CancelParticipation.as_view()),
    path('organizer/activities/<uuid:pk>/applicants/', ApplicantList.as_view()),
    path('organizer/activities/<uuid:pk>/applicants/<uuid:entry_id>/review/', ReviewParticipation.as_view()),
    path('organizer/activities/<uuid:pk>/attendance/', AttendanceList.as_view()),
    path('organizer/activities/<uuid:pk>/attendance/<uuid:entry_id>/', ConfirmAttendance.as_view()),
]
