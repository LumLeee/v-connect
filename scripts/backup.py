"""Back up the configured MySQL database and local media into ignored tmp/backups.

Run with .venv/Scripts/python scripts/backup.py. No database writes are performed.
"""
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


def option_value(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r') + '"'


def main():
    load_dotenv(ROOT / 'backend/.env')
    executable = shutil.which('mysqldump')
    windows_path = Path(r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe')
    if not executable and windows_path.is_file():
        executable = str(windows_path)
    if not executable:
        raise SystemExit('mysqldump is unavailable; install the MySQL client or add it to PATH.')
    keys = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT']
    if any(key not in os.environ for key in keys):
        raise SystemExit('Missing database settings in backend/.env.')
    parent = ROOT / 'tmp/backups'
    parent.mkdir(parents=True, exist_ok=True)
    directory = parent / ('snapshot-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    directory.mkdir()
    descriptor, config = tempfile.mkstemp(suffix='.cnf', dir=directory)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
            handle.write('[client]\n' + '\n'.join(f'{key}={option_value(os.environ[env])}' for key, env in
                [('user', 'DB_USER'), ('password', 'DB_PASSWORD'), ('host', 'DB_HOST'), ('port', 'DB_PORT')]) + '\n')
        sql = directory / 'database.sql'
        with sql.open('wb') as output:
            result = subprocess.run([executable, '--defaults-extra-file=' + config, '--single-transaction',
                '--no-tablespaces', '--set-gtid-purged=OFF', '--hex-blob', '--default-character-set=utf8mb4',
                os.environ['DB_NAME']], stdout=output, stderr=subprocess.PIPE)
        if result.returncode or b'CREATE TABLE' not in sql.read_bytes():
            raise SystemExit('Backup failed; do not use this snapshot. Database was not changed.')
    finally:
        Path(config).unlink(missing_ok=True)
    media = ROOT / 'backend/media'
    media_count = 0
    archive = directory / 'media.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        if media.is_dir():
            for file in media.rglob('*'):
                if file.is_file():
                    output.write(file, file.relative_to(media).as_posix())
                    media_count += 1
    manifest = {
        'created_at': datetime.now().astimezone().isoformat(),
        'database': os.environ['DB_NAME'], 'media_files': media_count,
        'sha256': {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in [sql, archive]},
    }
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Backup created:', directory)
    print('Includes database.sql, media.zip and manifest.json. No configuration secrets are included.')


if __name__ == '__main__':
    main()
