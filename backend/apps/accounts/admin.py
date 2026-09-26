from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User
from .forms import AccountChangeForm, AccountCreationForm


@admin.register(User)
class AccountAdmin(UserAdmin):
    readonly_fields = ['is_active']

    def has_delete_permission(self, request, obj=None):
        return False

    form = AccountChangeForm
    add_form = AccountCreationForm
    ordering = ["role", "username", "email"]
    list_display = ["username", "email", "full_name", "role", "is_active", "is_staff"]
    search_fields = ["username", "email", "full_name"]
    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        ("Hồ sơ", {"fields": ("full_name", "role")}),
        ("Quyền", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Thời gian", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("username", "email", "full_name", "role", "password1", "password2")}),)
