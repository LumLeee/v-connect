from django.urls import path
from .profile_views import AvatarView, ProfileView

from .views import CsrfView, LoginView, LogoutView, MeView, PasswordResetConfirmView, PasswordResetView, RegisterView, WorkspaceView

urlpatterns = [
    path("profile/", ProfileView.as_view()),
    path("profile/avatar/", AvatarView.as_view()),
    path("csrf/", CsrfView.as_view()),
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("password-reset/", PasswordResetView.as_view()),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("workspace/<str:role>/", WorkspaceView.as_view()),
]
