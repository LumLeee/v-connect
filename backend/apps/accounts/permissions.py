from rest_framework.permissions import BasePermission


class HasWorkspaceRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and user.is_active and user.role == view.kwargs.get("role"))
