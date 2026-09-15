param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('backend', 'frontend')]
    [string]$Target
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot
try {
    if ($Target -eq 'backend') {
        & "$ProjectRoot/.venv/Scripts/python.exe" backend/manage.py runserver 127.0.0.1:8000
    } else {
        Set-Location "$ProjectRoot/frontend"
        & npm.cmd run dev
    }
    if ($LASTEXITCODE -ne 0) { throw "Development server exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}
