"""Use fresh owned databases for both interactive and noninteractive tests."""
from django.core.exceptions import ImproperlyConfigured
from django.db import connections
from django.test.runner import DiscoverRunner


class SafeDiscoverRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        if self.keepdb or self.parallel > 1:
            raise ImproperlyConfigured(
                'Project tests require a fresh database and one worker; '
                '--keepdb and --parallel > 1 are not supported.'
            )
        if any(getattr(connection.creation, '_owned_name', None) is not None
               for connection in connections.all()):
            raise ImproperlyConfigured('A test database is already in use by this connection.')
        try:
            return super().setup_databases(**kwargs)
        except BaseException as error:
            # Django does not enter its teardown finally if setup_databases fails.
            # The failing connection handles itself; clean any earlier aliases too.
            for connection in connections.all():
                cleanup = getattr(connection.creation, 'cleanup_failed_setup', None)
                if cleanup:
                    try:
                        cleanup()
                    except Exception as cleanup_error:
                        error.add_note(f'Test database cleanup was refused: {cleanup_error}')
            raise
