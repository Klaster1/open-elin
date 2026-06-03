# firmware-pod/unbrick.ps1
# Recover a bricked SuperMini nRF52840 via SWD (CMSIS-DAP probe).
#
# Wiring (probe → SuperMini):
#   black  → CLK
#   white  → IO
#   grey   → GND
#   purple → 3V3
#
# What this does:
#   1. Connects to the chip via SWD
#   2. nrf52_recover: mass-erases flash + unlocks APPROTECT
#   3. Re-flashes the nice_nano UF2 bootloader
#   4. Resets — device should appear as UF2 drive again
#
# After recovery, flash firmware.uf2 via the UF2 drive as usual.

$ErrorActionPreference = "Stop"

$openocd = "c:\dev\nxs\tools\pod-firmware\openocd\bin\openocd.exe"
$scripts = "c:\dev\nxs\tools\pod-firmware\openocd\share\openocd\scripts"
$bootloader = "$PSScriptRoot\nice_nano_bootloader.hex"

# Bootloader is not version-controlled. Download on demand.
$bootloaderVersion = "0.11.0"
$bootloaderUrl = "https://github.com/adafruit/Adafruit_nRF52_Bootloader/releases/download/$bootloaderVersion/nice_nano_bootloader-${bootloaderVersion}_s140_6.1.1.hex"
$bootloaderSha256 = "1B72D4CD163239DEC96231B3549D541CBC96B7A64B3041B635482CA4D7441F7E"

if (-not (Test-Path $openocd)) {
    Write-Host "ERROR: OpenOCD not found at $openocd" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $bootloader)) {
    Write-Host "Bootloader not found locally. Downloading $bootloaderVersion from GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest $bootloaderUrl -OutFile $bootloader -UseBasicParsing
}

$actualHash = (Get-FileHash $bootloader -Algorithm SHA256).Hash
if ($actualHash -ne $bootloaderSha256) {
    Write-Host "ERROR: Bootloader checksum mismatch!" -ForegroundColor Red
    Write-Host "  Expected: $bootloaderSha256" -ForegroundColor Red
    Write-Host "  Got:      $actualHash" -ForegroundColor Red
    Remove-Item $bootloader
    exit 1
}
Write-Host "Bootloader verified (SHA256 OK)" -ForegroundColor Green

# Step 1: Verify SWD connection
Write-Host "`n=== Step 1: Testing SWD connection ===" -ForegroundColor Cyan
& $openocd -s $scripts -f interface/cmsis-dap.cfg -f target/nordic/nrf52.cfg `
    -c "init; targets; exit"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect via SWD. Check wiring." -ForegroundColor Red
    exit 1
}
Write-Host "SWD connection OK" -ForegroundColor Green

# Step 2: Mass erase + flash bootloader
Write-Host "`n=== Step 2: Recovering chip (mass erase + bootloader flash) ===" -ForegroundColor Cyan
Write-Host "This will erase ALL flash (app + bonds + bootloader) and restore the bootloader." -ForegroundColor Yellow
& $openocd -s $scripts -f interface/cmsis-dap.cfg -f target/nordic/nrf52.cfg `
    -c "init; nrf52_recover; reset halt; program {$bootloader} verify; reset; exit"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Recovery failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Recovery complete ===" -ForegroundColor Green
Write-Host "The UF2 drive should now appear. Flash firmware.uf2 to it." -ForegroundColor Green
