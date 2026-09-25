from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("api/v1/", include("apps.participations.urls")),
    path("api/v1/", include("apps.activities.urls")),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.core.urls")),
]
handler400 = "apps.core.exceptions.bad_request"
handler403 = "apps.core.exceptions.permission_denied"
handler404 = "apps.core.exceptions.not_found"
handler500 = "apps.core.exceptions.server_error"
