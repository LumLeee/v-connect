from django.contrib.auth.backends import ModelBackend

from .models import User


class IdentityBackend(ModelBackend):
    """Admin signs in by username; public roles sign in by email."""

    def authenticate(self, request, username=None, password=None, identifier=None, email=None, **kwargs):
        value = identifier if identifier is not None else username if username is not None else email
        if not value or password is None:
            return None
        value = value.strip().lower()
        query = {"email": value, "role__in": [User.Role.VOLUNTEER, User.Role.ORGANIZER]} if "@" in value else {"username": value, "role": User.Role.ADMIN}
        try:
            user = User.objects.get(**query)
        except User.DoesNotExist:
            # Match the password hashing cost for unknown identities.
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
