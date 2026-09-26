"""Guard against accidentally asking Django to destroy an application database."""
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_e2e as runner
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from e2e_clock import TestClockWSGI, scoped_now, real_now, require_test_database


class CleanupSafetyTests(unittest.TestCase):
    def check_case(self, target, original, active_connection, active_settings, allowed=False):
        destroy = Mock()
        connection = SimpleNamespace(settings_dict={'NAME': active_connection}, creation=SimpleNamespace(destroy_test_db=destroy))
        settings = SimpleNamespace(DATABASES={'default': {'NAME': active_settings}})
        with patch.object(runner, 'connection', connection), patch.object(runner, 'settings', settings):
            if allowed:
                runner.cleanup_test_database(target, original)
                destroy.assert_called_once_with(original, verbosity=0)
            else:
                with self.assertRaises(RuntimeError):
                    runner.cleanup_test_database(target, original)
                destroy.assert_not_called()

    def test_never_destroys_active_application_database(self):
        self.check_case('test_v_connect', 'v_connect', 'v_connect', 'v_connect')

    def test_requires_both_settings_and_connection_to_match(self):
        self.check_case('test_v_connect', 'v_connect', 'test_v_connect', 'v_connect')
        self.check_case('test_v_connect', 'v_connect', 'v_connect', 'test_v_connect')

    def test_refuses_test_name_equal_to_application_name(self):
        self.check_case('test_v_connect', 'test_v_connect', 'test_v_connect', 'test_v_connect')

    def test_refuses_non_test_database_name(self):
        self.check_case('another_database', 'v_connect', 'another_database', 'another_database')

    def test_allows_only_matching_disposable_database(self):
        self.check_case('test_v_connect', 'v_connect', 'test_v_connect', 'test_v_connect', allowed=True)


class ClockSafetyTests(unittest.TestCase):
    def test_refuses_application_database(self):
        for values in [('test_v_connect', 'v_connect', 'v_connect', 'v_connect'),
                       ('v_connect', 'v_connect', 'v_connect', 'v_connect'),
                       ('test_v_connect', 'v_connect', 'test_v_connect', 'v_connect')]:
            with self.assertRaises(RuntimeError):
                require_test_database(*values)

    def test_invalid_key_and_naive_time_do_not_call_application(self):
        app = Mock()
        wrapper = TestClockWSGI(app, 'test-secret', 'test_v_connect', 'v_connect', 'test_v_connect', 'test_v_connect')
        for value, key in [(real_now().isoformat(), 'wrong'), ('2026-01-01T12:00:00', 'test-secret')]:
            start = Mock()
            wrapper({'HTTP_X_E2E_TIME': value, 'HTTP_X_E2E_CLOCK_KEY': key}, start)
            self.assertEqual(start.call_args.args[0], '400 Bad Request')
        app.assert_not_called()

    def test_clock_is_isolated_per_request_and_resets_after_exception(self):
        barrier = Barrier(2)
        def app(environ, start):
            barrier.wait(timeout=5)
            return [scoped_now().isoformat().encode()]
        wrapper = TestClockWSGI(app, 'test-secret', 'test_v_connect', 'v_connect', 'test_v_connect', 'test_v_connect')
        moments = [real_now() + timedelta(hours=value) for value in [1, 2]]
        def call(moment):
            return wrapper({'HTTP_X_E2E_TIME': moment.isoformat(), 'HTTP_X_E2E_CLOCK_KEY': 'test-secret'}, Mock())[0]
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(call, moments)), [moment.isoformat().encode() for moment in moments])
        wrapper.application = Mock(side_effect=RuntimeError('expected'))
        with self.assertRaises(RuntimeError):
            call(moments[0])
        self.assertLess(abs((scoped_now() - real_now()).total_seconds()), 1)


if __name__ == '__main__':
    unittest.main()
