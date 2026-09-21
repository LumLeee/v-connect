from rest_framework.authentication import SessionAuthentication


class CsrfSessionAuthentication(SessionAuthentication):
    """Protect anonymous auth POSTs too; DRF normally checks CSRF only after login."""

    def authenticate(self, request):
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            self.enforce_csrf(request)
        return super().authenticate(request)

    def authenticate_header(self, request):
        return "Session"
