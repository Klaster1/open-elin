# test.ps1 — Run protocol unit tests via Docker
# Prerequisites: docker build -t open-elin-pod-firmware-toolchain .

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot

docker run --rm -v "${appDir}:/app" --entrypoint bash open-elin-pod-firmware-toolchain -c "cd /app/tests && make clean && make test"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests FAILED" -ForegroundColor Red
    exit 1
}
