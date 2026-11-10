"""Shared naming policy for disposable MySQL test schemas."""
import re

from django.core.exceptions import ImproperlyConfigured


def validate_test_database_name(test_name, application_name):
    if (not isinstance(test_name, str) or len(test_name) > 64
            or not re.fullmatch(r'test_[A-Za-z0-9_]+', test_name)):
        raise ImproperlyConfigured(
            'DB_TEST_NAME must begin with test_, contain only ASCII letters, digits '
            'or underscores, and be at most 64 characters.'
        )
    if test_name.casefold() == str(application_name).casefold():
        raise ImproperlyConfigured('DB_TEST_NAME must differ from DB_NAME, including letter case.')
    return test_name
