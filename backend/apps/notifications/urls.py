from django.urls import path
from . import views

urlpatterns = [
    path('notifications/', views.NotificationList.as_view()),
    path('notifications/unread-count/', views.UnreadCount.as_view()),
    path('notifications/read-all/', views.MarkRead.as_view()),
    path('notifications/preferences/', views.Preferences.as_view()),
    path('notifications/<uuid:pk>/read/', views.MarkRead.as_view()),
]
