from django import forms
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm

from .models import User


class IdentityFormMixin:
    def clean(self):
        data = super().clean()
        if not data.get("full_name"):
            if data.get("role") == User.Role.ADMIN and data.get("username"):
                data["full_name"] = data["username"]
            else:
                self.add_error("full_name", "Vui lòng nhập họ và tên.")
        return data


class AccountCreationForm(IdentityFormMixin, AdminUserCreationForm):
    full_name = forms.CharField(label="Họ và tên", max_length=150, required=False)

    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("username", "email", "full_name", "role")


class AccountChangeForm(IdentityFormMixin, UserChangeForm):
    full_name = forms.CharField(label="Họ và tên", max_length=150, required=False)

    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"
