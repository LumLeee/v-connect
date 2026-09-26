"""Guard against accidentally asking Django to destroy an application database."""
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_e2e as runner


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


if __name__ == '__main__':
    unittest.main()
