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
$bootloader = "c:/dev/nxs/firmware-pod/nice_nano_bootloader.hex"

if (-not (Test-Path $openocd)) {
    Write-Host "ERROR: OpenOCD not found at $openocd" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $bootloader)) {
    Write-Host "ERROR: Bootloader hex not found at $bootloader" -ForegroundColor Red
    Write-Host "Download from: https://github.com/adafruit/Adafruit_nRF52_Bootloader/releases" -ForegroundColor Yellow
    Write-Host "Get the nice_nano_bootloader-*_s140_*.hex file" -ForegroundColor Yellow
    exit 1
}

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
