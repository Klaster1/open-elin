# firmware-pod/build.ps1
# Build firmware via Docker. Produces firmware.uf2 in this directory.
# Prerequisites: docker build -t nxs-zephyr .

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot

Write-Host "Building firmware..." -ForegroundColor Cyan
docker run --rm -v "${appDir}:/app" -v nxs-zephyr-build:/workdir/zephyr/build nxs-zephyr

if ($LASTEXITCODE -ne 0) { exit 1 }

if (Test-Path "$appDir\firmware.uf2") {
    $size = (Get-Item "$appDir\firmware.uf2").Length / 1KB
    Write-Host "Build complete: firmware.uf2 ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
} else {
    Write-Host "Build failed - no firmware.uf2 produced" -ForegroundColor Red
    exit 1
}
