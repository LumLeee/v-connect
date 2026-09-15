"""Provision only the configured development database and local app account.

Run from the repository root: .venv/Scripts/python backend/scripts/setup_mysql.py
Admin credentials are read from backend/.env and never printed.
"""
import os
import re
import sys
from pathlib import Path

import MySQLdb
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def main():
    database = os.environ.get("DB_NAME", "v_connect")
    test_database = os.environ.get("DB_TEST_NAME", "test_v_connect")
    username = os.environ.get("DB_USER", "v_connect")
    password = os.environ.get("DB_PASSWORD", "")
    for identifier in (database, test_database, username):
        if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]{0,31}", identifier):
            raise ValueError("Use simple alphanumeric names, at most 32 characters.")
    if database == test_database or username in {"root", "mysql", "admin"}:
        raise ValueError("Use a dedicated application user and separate test database.")
    if len(password) < 16:
        raise ValueError("Set DB_PASSWORD to a random value of at least 16 characters.")
    connection = MySQLdb.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("MYSQL_ADMIN_USER", "root"),
        passwd=os.environ.get("MYSQL_ADMIN_PASSWORD", ""),
        charset="utf8mb4", connect_timeout=5,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            # Do not overwrite the password of any existing account.
            cursor.execute("CREATE USER IF NOT EXISTS %s@'localhost' IDENTIFIED BY %s", (username, password))
            for name in (database, test_database):
                # Escape wildcard '_' in MySQL's database-level grants.
                grant_name = name.replace("_", r"\_")
                cursor.execute(f"GRANT ALL PRIVILEGES ON `{grant_name}`.* TO %s@'localhost'", (username,))
        connection.commit()
        print("Configured application database and local development/test privileges.")
        print("Existing account passwords were not changed. Run migrate next.")
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except MySQLdb.Error as exc:
        # Never print SQL or credentials (including failed CREATE USER queries).
        print(f"MySQL setup failed (error {exc.args[0]}). Check backend/.env and MySQL80 permissions.", file=sys.stderr)
        sys.exit(1)
