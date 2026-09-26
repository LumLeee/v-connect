"""Run Playwright against real React/Django and a disposable MySQL test database.

Uses config.settings without creating a second settings module. Never reuses a
running development server or an existing test database. Run after scripts/check.py.
"""
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, WSGIRequestHandler, make_server
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.conf import settings
from django.core.management import call_command
from django.core.wsgi import get_wsgi_application
from django.db import connection, connections
from django.test import override_settings


class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class QuietHandler(WSGIRequestHandler):
    def log_message(self, format, *args):
        pass


def cleanup_test_database(database, original_database):
    """Django destroys the ACTIVE database, so validate it before calling it."""
    if (
        not database.startswith('test_')
        or database == original_database
        or connection.settings_dict['NAME'] != database
        or settings.DATABASES['default']['NAME'] != database
    ):
        raise RuntimeError('Refusing cleanup: active database is not the E2E test database.')
    connection.creation.destroy_test_db(original_database, verbosity=0)


def main():
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    node = shutil.which("node")
    if not npm or not node:
        raise SystemExit("Install Node.js/npm first.")
    for port in (8001, 5174):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", port))
    database = connection.settings_dict["TEST"]["NAME"]
    if not database.startswith("test_") or database == connection.settings_dict["NAME"]:
        raise SystemExit("E2E requires a separate DB_TEST_NAME beginning with test_.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = %s", [database])
        if cursor.fetchone():
            raise SystemExit("Test database already exists. Refusing to reuse/delete it; finish other tests first.")
    run_dir = ROOT / "tmp" / ("e2e-" + secrets.token_hex(6))
    run_dir.mkdir(parents=True)
    email_dir = run_dir / "emails"
    email_dir.mkdir()
    env = os.environ.copy()
    env.update({
        "E2E_BASE_URL": "http://127.0.0.1:5174",
        "E2E_BACKEND_URL": "http://127.0.0.1:8001",
        "E2E_MAIL_DIR": str(email_dir),
        "E2E_ARTIFACT_DIR": str(run_dir / "screenshots"),
        "E2E_ADMIN_USERNAME": "admin.e2e",
        "E2E_ADMIN_PASSWORD": secrets.token_urlsafe(24),
        "E2E_CLOCK_KEY": secrets.token_urlsafe(32),
        "VITE_BACKEND_PROXY": "http://127.0.0.1:8001",
        "VITE_API_BASE_URL": "/api/v1",
    })
    rest = dict(settings.REST_FRAMEWORK)
    # Browser tests share one loopback IP. Actual production limits are tested
    # separately by accounts/tests.py; CSRF and session checks stay enabled.
    rest["DEFAULT_THROTTLE_RATES"] = {"anon": "2000/minute", "user": "2000/minute", "auth": "2000/minute", "password_reset": "2000/minute"}
    overrides = override_settings(
        DEBUG=False, ALLOWED_HOSTS=["127.0.0.1", "localhost"],
        CSRF_TRUSTED_ORIGINS=[env["E2E_BASE_URL"]], FRONTEND_URL=env["E2E_BASE_URL"],
        SECURE_SSL_REDIRECT=False, SESSION_COOKIE_SECURE=False, CSRF_COOKIE_SECURE=False,
        EMAIL_BACKEND="django.core.mail.backends.filebased.EmailBackend",
        EMAIL_FILE_PATH=str(email_dir), REST_FRAMEWORK=rest, MEDIA_ROOT=str(run_dir / "media"),
    )
    server = frontend = None
    original_database = connection.settings_dict["NAME"]
    database_created = False
    clock_patch = None
    try:
        overrides.enable()
        connection.creation.create_test_db(verbosity=0, autoclobber=False, keepdb=False)
        database_created = True
        from apps.accounts.models import User
        User.objects.create_superuser(env["E2E_ADMIN_USERNAME"], env["E2E_ADMIN_PASSWORD"], full_name="Quản trị kiểm thử")
        from e2e_attendance import seed_attendance
        seed_attendance(env, database, original_database)
        call_command("seed_data", verbosity=0)
        from apps.core.models import Skill
        from django.db.migrations.executor import MigrationExecutor
        seed_before = list(Skill.objects.order_by('pk').values())
        call_command('seed_data', verbosity=0)
        assert list(Skill.objects.order_by('pk').values()) == seed_before, 'Seed data must be idempotent.'
        executor = MigrationExecutor(connection)
        assert not executor.migration_plan(executor.loader.graph.leaf_nodes()), 'Fresh database has pending migrations.'
        print(f'Fresh MySQL database verified: {len(executor.loader.applied_migrations)} migrations applied; seed is idempotent.', flush=True)
        connections.close_all()
        from e2e_clock import TestClockWSGI, scoped_now
        application = TestClockWSGI(get_wsgi_application(), env['E2E_CLOCK_KEY'], database, original_database,
                                    connection.settings_dict['NAME'], settings.DATABASES['default']['NAME'])
        clock_patch = patch('django.utils.timezone.now', scoped_now)
        clock_patch.start()
        server = make_server("127.0.0.1", 8001, application, server_class=ThreadedServer, handler_class=QuietHandler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        with (run_dir / "vite.log").open("w", encoding="utf-8") as log:
            frontend = subprocess.Popen([node, str(ROOT / "frontend/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5174"], cwd=ROOT / "frontend", env=env, stdout=log, stderr=subprocess.STDOUT)
            for _ in range(120):
                if frontend.poll() is not None:
                    raise RuntimeError(f"Vite exited; see {run_dir / 'vite.log'}")
                try:
                    with urllib.request.urlopen(env["E2E_BASE_URL"] + "/api/v1/health/", timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.5)
            else:
                raise RuntimeError("E2E servers did not become ready.")
            print(f"Browser evidence: {run_dir / 'screenshots'}", flush=True)
            return subprocess.call([npm, "run", "test:e2e", "--", *sys.argv[1:]], cwd=ROOT / "frontend", env=env)
    finally:
        try:
            if frontend and frontend.poll() is None:
                frontend.terminate()
                try:
                    frontend.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    frontend.kill()
                    frontend.wait(timeout=5)
        finally:
            try:
                if server:
                    server.shutdown()
                    server.server_close()
                connections.close_all()
                if database_created:
                    cleanup_test_database(database, original_database)
                    print("Disposable E2E database removed.", flush=True)
            finally:
                if clock_patch:
                    clock_patch.stop()
                overrides.disable()


if __name__ == "__main__":
    raise SystemExit(main())
