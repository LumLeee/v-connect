from django.urls import path
from .views import MyList, MyParticipation, CancelParticipation, ApplicantList, ReviewParticipation

urlpatterns = [
    path('participations/', MyList.as_view()),
    path('activities/<uuid:pk>/participation/', MyParticipation.as_view()),
    path('activities/<uuid:pk>/participation/cancel/', CancelParticipation.as_view()),
    path('organizer/activities/<uuid:pk>/applicants/', ApplicantList.as_view()),
    path('organizer/activities/<uuid:pk>/applicants/<uuid:entry_id>/review/', ReviewParticipation.as_view()),
]
