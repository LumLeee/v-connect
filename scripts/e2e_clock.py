"""Request-local clock for the disposable E2E server. Never imported by the app."""
from contextvars import ContextVar
from datetime import datetime, timezone as datetime_timezone
from secrets import compare_digest

from django.utils import timezone

real_now = timezone.now
request_time = ContextVar('e2e_request_time', default=None)


def scoped_now():
    return request_time.get() or real_now()


def require_test_database(database, original, connection_name, settings_name):
    if not database.startswith('test_') or database == original or connection_name != database or settings_name != database:
        raise RuntimeError('Test clock requires the active disposable E2E database.')


class TestClockWSGI:
    def __init__(self, application, secret, database, original, connection_name, settings_name):
        require_test_database(database, original, connection_name, settings_name)
        if not secret:
            raise RuntimeError('A random test clock secret is required.')
        self.application = application
        self.secret = secret

    def __call__(self, environ, start_response):
        value = environ.get('HTTP_X_E2E_TIME')
        moment = None
        if value:
            try:
                if not compare_digest(environ.get('HTTP_X_E2E_CLOCK_KEY', ''), self.secret):
                    raise ValueError('Invalid test key')
                moment = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if moment.tzinfo is None or abs((moment - real_now()).total_seconds()) > 7 * 86400:
                    raise ValueError('Invalid test time')
                moment = moment.astimezone(datetime_timezone.utc)
            except (ValueError, TypeError):
                start_response('400 Bad Request', [('Content-Type', 'text/plain')])
                return [b'Invalid test clock request.']
        token = request_time.set(moment)
        response = None
        try:
            response = self.application(environ, start_response)
            return list(response)
        finally:
            if response is not None and hasattr(response, 'close'):
                response.close()
            request_time.reset(token)
