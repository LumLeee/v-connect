from django.urls import path
from .views import AdminFeedback, HideFeedback, MyFeedback, OrganizerFeedback

urlpatterns = [
    path('activities/<uuid:pk>/feedback/', MyFeedback.as_view()),
    path('organizer/activities/<uuid:pk>/feedback/', OrganizerFeedback.as_view()),
    path('admin/feedback/', AdminFeedback.as_view()),
    path('admin/feedback/<uuid:pk>/hide/', HideFeedback.as_view()),
]
