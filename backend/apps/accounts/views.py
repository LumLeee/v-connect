import logging

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import User
from .permissions import HasWorkspaceRole
from .serializers import EmailSerializer, LoginSerializer, RegisterSerializer, ResetConfirmSerializer, UserSerializer

logger = logging.getLogger("vconnect.auth")


@method_decorator(never_cache, name="dispatch")
class AuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class CsrfView(AuthView):
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(AuthView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        values.pop("password_confirm")
        try:
            with transaction.atomic():
                user = User.objects.create_user(**values)
        except (IntegrityError, DjangoValidationError):
            raise ValidationError({"email": "Email này đã được đăng ký."})
        login(request, user)
        request.session.set_expiry(0)
        return Response({"user": UserSerializer(user).data}, status=201)


class LoginView(AuthView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        user = authenticate(request=request, identifier=values["identifier"], password=values["password"])
        if user is None:
            raise AuthenticationFailed("Thông tin đăng nhập không đúng, hoặc tài khoản không khả dụng.")
        login(request, user)
        request.session.set_expiry(settings.SESSION_COOKIE_AGE if values["remember"] else 0)
        return Response({"user": UserSerializer(user).data})


class LogoutView(AuthView):
    def post(self, request):
        logout(request)
        return Response({"message": "Đã đăng xuất."})


class MeView(AuthView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": UserSerializer(request.user).data})


class WorkspaceView(AuthView):
    permission_classes = [IsAuthenticated, HasWorkspaceRole]

    def get(self, request, role):
        return Response({"user": UserSerializer(request.user).data, "workspace": role})


class PasswordResetView(AuthView):
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email=serializer.validated_data["email"], is_active=True, role__in=[User.Role.VOLUNTEER, User.Role.ORGANIZER]).first()
        if user and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            # Use configured origin, never a caller-controlled Host header or redirect URL.
            url = f"{settings.FRONTEND_URL}/dat-lai-mat-khau/{uid}/{token}"
            try:
                send_mail(
                    "Đặt lại mật khẩu V-Connect",
                    f"Bạn đã yêu cầu đặt lại mật khẩu V-Connect.\n\nMở liên kết sau trong vòng 1 giờ:\n{url}\n\nNếu không yêu cầu, bạn có thể bỏ qua email này.",
                    settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False,
                )
            except Exception:
                logger.error("Password reset email delivery failed; check email configuration.")
        return Response({"message": "Nếu email thuộc tài khoản đang hoạt động, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu."})


class PasswordResetConfirmView(AuthView):
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ResetConfirmSerializer(data=request.data)
        # Validate shape before decoding the UID or looking up a user.
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            uid = urlsafe_base64_decode(values["uid"]).decode()
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=uid, is_active=True, role__in=[User.Role.VOLUNTEER, User.Role.ORGANIZER])
                if not default_token_generator.check_token(user, values["token"]):
                    raise ValueError("Invalid token")
                validated = ResetConfirmSerializer(data=request.data, context={"user": user})
                validated.is_valid(raise_exception=True)
                user.set_password(validated.validated_data["password"])
                user.save(update_fields=["password"])
        except (ValueError, UnicodeDecodeError, User.DoesNotExist, OverflowError, DjangoValidationError):
            raise ValidationError({"token": "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới."})
        # Existing sessions are invalidated by Django's password hash check.
        logout(request)
        return Response({"message": "Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới."})
