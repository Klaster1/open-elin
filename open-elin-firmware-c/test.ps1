# test.ps1 — Run protocol unit tests via Docker
# Prerequisites: docker build -t nxs-zephyr .

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot

docker run --rm -v "${appDir}:/app" --entrypoint bash nxs-zephyr -c "cd /app/tests && make clean && make test"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests FAILED" -ForegroundColor Red
    exit 1
}
