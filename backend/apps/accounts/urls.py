from django.urls import path

from .views import CsrfView, LoginView, LogoutView, MeView, PasswordResetConfirmView, PasswordResetView, RegisterView, WorkspaceView

urlpatterns = [
    path("csrf/", CsrfView.as_view()),
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("password-reset/", PasswordResetView.as_view()),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("workspace/<str:role>/", WorkspaceView.as_view()),
]
