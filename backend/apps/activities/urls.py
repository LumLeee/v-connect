from django.urls import path
from .views import PublicList, PublicDetail, ManagedList, ManagedDetail, TransitionView

urlpatterns = [
    path('activities/', PublicList.as_view()),
    path('activities/<uuid:pk>/', PublicDetail.as_view()),
    path('organizer/activities/', ManagedList.as_view()),
    path('organizer/activities/<uuid:pk>/', ManagedDetail.as_view()),
    path('organizer/activities/<uuid:pk>/status/', TransitionView.as_view()),
]
