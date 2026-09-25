"""Run the phase-one checks without changing PowerShell execution policy."""
import os
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = os.environ.copy()
npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
if not npm:
    raise SystemExit("npm is not on PATH; install Node.js first.")
commands = [
    ([sys.executable, "backend/manage.py", "check"], root),
    ([sys.executable, "backend/manage.py", "makemigrations", "--check", "--dry-run"], root),
    ([sys.executable, "backend/manage.py", "test", "apps.core", "apps.accounts", "apps.activities", "apps.participations", "apps.feedback", "--noinput"], root),
    ([sys.executable, "scripts/test_e2e_safety.py"], root),
    ([npm, "run", "lint"], root / "frontend"),
    ([npm, "run", "build"], root / "frontend"),
]
for command, cwd in commands:
    print(f"Running: {' '.join(command[1:])}", flush=True)
    result = subprocess.run(command, cwd=cwd, env=env, check=False)
    if result.returncode:
        raise SystemExit(result.returncode)
print("All project checks passed.")
