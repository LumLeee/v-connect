$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot
try {
    & "$ProjectRoot/.venv/Scripts/python.exe" backend/manage.py check
    if ($LASTEXITCODE -ne 0) { throw 'Django check failed.' }
    & "$ProjectRoot/.venv/Scripts/python.exe" backend/manage.py makemigrations --check --dry-run
    if ($LASTEXITCODE -ne 0) { throw 'Uncommitted model changes require migrations.' }
    & "$ProjectRoot/.venv/Scripts/python.exe" backend/manage.py test apps.core apps.accounts apps.activities apps.participations apps.feedback apps.reports --noinput
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
    & "$ProjectRoot/.venv/Scripts/python.exe" scripts/test_e2e_safety.py
    if ($LASTEXITCODE -ne 0) { throw 'E2E database safety tests failed.' }
    Set-Location "$ProjectRoot/frontend"
    & npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally {
    Pop-Location
}
