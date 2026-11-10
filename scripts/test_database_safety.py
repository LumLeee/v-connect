"""Exercise test-database ownership guards without opening a database socket.

Run directly: .venv/Scripts/python.exe scripts/test_database_safety.py
The real project's database backend and Django lifecycle are used; only SQL
transport and management commands are replaced by in-memory test doubles.
"""
from contextlib import contextmanager
from copy import deepcopy
import os
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DJANGO_SECRET_KEY", "database-safety-regression-only")
os.environ.setdefault("DB_PASSWORD", "not-a-real-database-password")
os.environ.setdefault("DB_NAME", "vconnect_safety_application")
os.environ.setdefault("DB_TEST_NAME", "test_vconnect_safety")

import django

# Unit checks must not depend on, or load credentials from, a developer's .env.
with patch("dotenv.load_dotenv", return_value=False):
    django.setup()

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import OperationalError
from django.test.runner import DiscoverRunner

from config.db.base import DatabaseWrapper
from config.test_database import validate_test_database_name
from config.test_runner import SafeDiscoverRunner


APPLICATION = "vconnect_safety_application"
DATABASE = "test_vconnect_safety"


class RecordingServer:
    """Record DDL and simulate an independently mutable server ownership row."""

    def __init__(self, existing=False, create_error=None):
        self.schemas = {DATABASE} if existing else set()
        self.marker = None
        self.statements = []
        self.create_error = create_error
        self.marker_create_error = None
        self.marker_insert_error = None
        self.marker_table_exists = False
        self.select_error = None
        self.result = None

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        self.statements.append((sql, params))
        self.result = None
        upper = sql.upper()
        identifiers = re.findall(r"`([^`]+)`", sql)
        if upper.startswith("CREATE DATABASE "):
            if self.create_error:
                raise self.create_error
            name = identifiers[0]
            if name in self.schemas:
                raise OperationalError(1007, "Database already exists")
            self.schemas.add(name)
        elif upper.startswith("CREATE TABLE "):
            if self.marker_create_error:
                raise self.marker_create_error
            self.marker_table_exists = True
            self.marker = None
        elif upper.startswith("INSERT INTO "):
            if self.marker_insert_error:
                raise self.marker_insert_error
            self.marker = params[-1]
        elif upper.startswith("SELECT "):
            if self.select_error:
                raise self.select_error
            if not self.marker_table_exists:
                raise OperationalError(1146, "Ownership table does not exist")
            if self.marker is not None:
                self.result = (self.marker,)
        elif upper.startswith("DROP DATABASE "):
            self.schemas.remove(identifiers[0])
            self.marker = None
            self.marker_table_exists = False
        else:
            raise AssertionError(f"Unexpected SQL in safety test: {sql}")

    def fetchone(self):
        return self.result

    def fetchall(self):
        return (self.result,) if self.result is not None else ()

    def matching(self, prefix):
        return [sql for sql, _ in self.statements if sql.upper().startswith(prefix)]


class DatabaseGuardTests(unittest.TestCase):
    def setUp(self):
        config = deepcopy(settings.DATABASES["default"])
        config.update({"ENGINE": "config.db", "NAME": APPLICATION,
                       "HOST": "127.0.0.1", "PORT": "3306", "USER": "unit-test",
                       "PASSWORD": "not-real", "TIME_ZONE": None,
                       "AUTOCOMMIT": True, "CONN_HEALTH_CHECKS": False})
        config["TEST"] = {"NAME": DATABASE, "CHARSET": "utf8mb4",
                          "COLLATION": "utf8mb4_unicode_ci", "MIGRATE": True,
                          "MIRROR": None}
        self.config = config
        self.settings_config = deepcopy(config)
        self.settings_override = patch.object(settings, "DATABASES", {"default": self.settings_config})
        self.settings_override.start()
        self.connection = DatabaseWrapper(config, "default")
        self.server = RecordingServer()
        self.addCleanup(patch.stopall)
        patch.object(self.connection, "_nodb_cursor", self.server.cursor).start()
        patch.object(self.connection, "cursor", self.server.cursor).start()
        patch.object(self.connection, "get_new_connection", side_effect=AssertionError("Database sockets forbidden")).start()
        patch.object(self.connection, "ensure_connection").start()
        patch.object(self.connection, "close").start()
        self.commands = patch("django.core.management.call_command").start()
        self.prompt = patch("builtins.input", side_effect=AssertionError("No database deletion prompts permitted")).start()

    def create(self, **kwargs):
        return self.connection.creation.create_test_db(verbosity=0, serialize=False, **kwargs)

    def assert_no_drop(self):
        self.assertEqual(self.server.matching("DROP DATABASE "), [])
        self.prompt.assert_not_called()

    def test_existing_database_is_never_replaced_with_or_without_noinput(self):
        for autoclobber in (False, True):
            with self.subTest(autoclobber=autoclobber):
                self.server.schemas.add(DATABASE)
                with self.assertRaises((ImproperlyConfigured, RuntimeError, OperationalError)):
                    self.create(autoclobber=autoclobber)
                self.assertIn(DATABASE, self.server.schemas)
                self.assert_no_drop()
        self.commands.assert_not_called()
        self.assertEqual(self.config["NAME"], APPLICATION)

    def test_create_permission_error_never_falls_back_to_deletion(self):
        self.server.create_error = OperationalError(1044, "Permission denied")
        with self.assertRaises((ImproperlyConfigured, RuntimeError, OperationalError)):
            self.create(autoclobber=True)
        self.assert_no_drop()
        self.commands.assert_not_called()

    def test_keepdb_refused_before_sql(self):
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.create(keepdb=True)
        self.assertEqual(self.server.statements, [])
        self.commands.assert_not_called()

    def test_fresh_schema_created_atomically_and_only_owned_schema_dropped(self):
        self.assertEqual(self.create(autoclobber=True), DATABASE)
        self.assertEqual(len(self.server.matching("CREATE DATABASE ")), 1)
        self.assertNotIn("IF NOT EXISTS", self.server.matching("CREATE DATABASE ")[0])
        self.assertTrue(self.server.marker)
        self.assertEqual(self.config["NAME"], DATABASE)
        self.assertEqual(settings.DATABASES["default"]["NAME"], DATABASE)
        self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assertEqual(len(self.server.matching("DROP DATABASE ")), 1)
        self.assertNotIn(DATABASE, self.server.schemas)
        self.assertEqual(self.config["NAME"], APPLICATION)
        self.assertEqual(settings.DATABASES["default"]["NAME"], APPLICATION)
        self.prompt.assert_not_called()

    def test_repeated_create_preserves_first_owned_schema_and_normal_cleanup(self):
        self.create()
        statements = list(self.server.statements)
        marker = self.server.marker
        with self.assertRaisesRegex(ImproperlyConfigured, "already owns a test database"):
            self.create(autoclobber=True)
        self.assertEqual(self.server.statements, statements)
        self.assertIn(DATABASE, self.server.schemas)
        self.assertEqual(self.server.marker, marker)
        self.assert_no_drop()
        self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assertNotIn(DATABASE, self.server.schemas)
        self.assertEqual(len(self.server.matching("DROP DATABASE ")), 1)
        self.assertEqual(self.config["NAME"], APPLICATION)
        self.assertEqual(settings.DATABASES["default"]["NAME"], APPLICATION)

    def test_options_database_override_is_refused_before_sql(self):
        self.assert_database_override_refused("database")

    def test_options_db_override_is_refused_before_sql(self):
        self.assert_database_override_refused("db")

    def assert_database_override_refused(self, option):
        self.config["OPTIONS"][option] = APPLICATION
        with self.assertRaises(ImproperlyConfigured):
            self.create(autoclobber=True)
        self.assertEqual(self.server.statements, [])
        self.commands.assert_not_called()
        self.assertEqual(self.config["NAME"], APPLICATION)
        self.assertEqual(settings.DATABASES["default"]["NAME"], APPLICATION)

    def test_marker_table_creation_failure_preserves_unverified_schema(self):
        self.assert_marker_setup_failure_preserves_schema("marker_create_error", 1142)

    def test_marker_insert_failure_preserves_unverified_schema(self):
        self.assert_marker_setup_failure_preserves_schema("marker_insert_error", 1142)

    def assert_marker_setup_failure_preserves_schema(self, failure_attribute, error_code):
        self.server.schemas.add(APPLICATION)
        error = OperationalError(error_code, "Ownership marker setup denied")
        setattr(self.server, failure_attribute, error)
        with self.assertRaises(OperationalError) as failure:
            self.create(autoclobber=True)
        self.assertIs(failure.exception, error)
        self.assertIn(DATABASE, self.server.schemas)
        self.assertIn(APPLICATION, self.server.schemas)
        self.assert_no_drop()
        self.commands.assert_not_called()
        self.assertIsNone(self.server.marker)
        self.assertTrue(any(
            "cleanup was refused" in note
            for note in getattr(failure.exception, "__notes__", [])
        ))
        self.assertTrue(all(
            APPLICATION not in sql
            for sql, _ in self.server.statements
        ))

    def test_cleanup_without_this_run_ownership_cannot_drop_existing_schema(self):
        self.config["NAME"] = DATABASE
        self.settings_config["NAME"] = DATABASE
        self.server.schemas.add(DATABASE)
        self.server.marker = "another-run-token"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_changed_active_connection_name_prevents_cleanup(self):
        self.create()
        self.config["NAME"] = "test_another_schema"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_changed_active_settings_name_prevents_cleanup(self):
        self.create()
        self.settings_config["NAME"] = "test_another_schema"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_changed_endpoint_prevents_cleanup(self):
        self.create()
        self.config["HOST"] = "another-database-host"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_changed_settings_endpoint_prevents_cleanup(self):
        self.create()
        self.settings_config["HOST"] = "another-database-host"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_changed_options_prevent_cleanup(self):
        self.create()
        self.config["OPTIONS"]["read_default_file"] = "different-server.cnf"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_missing_marker_prevents_cleanup(self):
        self.create()
        self.server.marker = None
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_replaced_marker_prevents_cleanup(self):
        self.create()
        self.server.marker = "another-run-token"
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_unavailable_marker_table_prevents_cleanup(self):
        self.create()
        self.server.select_error = OperationalError(1146, "Table does not exist")
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation.destroy_test_db(APPLICATION, verbosity=0)
        self.assert_no_drop()

    def test_migration_failure_cleans_only_owned_schema_and_restores_original(self):
        self.assert_setup_failure_cleans_owned_schema("migrate")

    def test_cache_setup_failure_cleans_only_owned_schema_and_restores_original(self):
        self.assert_setup_failure_cleans_owned_schema("createcachetable")

    def assert_setup_failure_cleans_owned_schema(self, command):
        def fail_selected_command(name, *args, **kwargs):
            if name == command:
                raise RuntimeError(f"{command} failed")

        self.commands.side_effect = fail_selected_command
        with self.assertRaisesRegex(RuntimeError, f"{command} failed"):
            self.create(autoclobber=True)
        self.assertEqual(len(self.server.matching("DROP DATABASE ")), 1)
        self.assertNotIn(DATABASE, self.server.schemas)
        self.assertEqual(self.config["NAME"], APPLICATION)
        self.assertEqual(settings.DATABASES["default"]["NAME"], APPLICATION)

    def test_direct_drop_of_another_schema_refused(self):
        self.create()
        with self.assertRaises((ImproperlyConfigured, RuntimeError)):
            self.connection.creation._destroy_test_db("test_unrelated", verbosity=0)
        self.assert_no_drop()

    def test_direct_clone_is_refused_without_sql_or_subprocess(self):
        for method, args in [(self.connection.creation.clone_test_db, ("1",)),
                             (self.connection.creation._clone_test_db, ("1", 0))]:
            with self.subTest(method=method.__name__):
                with self.assertRaises((ImproperlyConfigured, RuntimeError)):
                    method(*args)
        self.assertEqual(self.server.statements, [])


class ConfigurationTests(unittest.TestCase):
    def test_name_validation_rejects_unsafe_or_application_names(self):
        for name in ["vconnect", "test_", "TEST_sample", "test_with-dash", "test_name`",
                     "test_name;DROP DATABASE x", "test_ảnh", "test_a\n", "test_" + "x" * 60]:
            with self.subTest(name=name), self.assertRaises(ImproperlyConfigured):
                validate_test_database_name(name, APPLICATION)
        with self.assertRaises(ImproperlyConfigured):
            validate_test_database_name("test_Same", "TEST_same")

    def test_valid_ascii_identifier_including_mysql_maximum(self):
        validate_test_database_name(DATABASE, APPLICATION)
        validate_test_database_name("test_" + "x" * 59, APPLICATION)

    def test_project_uses_guarded_backend_and_runner(self):
        self.assertEqual(settings.DATABASES["default"]["ENGINE"], "config.db")
        self.assertEqual(settings.TEST_RUNNER, "config.test_runner.SafeDiscoverRunner")

    def test_runner_rejects_keepdb_and_parallel_before_setup(self):
        with patch.object(DiscoverRunner, "setup_databases") as setup:
            for options in [{"keepdb": True}, {"parallel": 2}]:
                with self.subTest(options=options):
                    with self.assertRaises((ImproperlyConfigured, RuntimeError)):
                        runner = SafeDiscoverRunner(verbosity=0, **options)
                        runner.setup_databases()
            setup.assert_not_called()


if __name__ == "__main__":
    unittest.main()
