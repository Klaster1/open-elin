# open-elin-firmware-c/flash.ps1
# Flash firmware.uf2 to the SuperMini via UF2 bootloader.
# Usage: .\flash.ps1
#   Enter bootloader first: short RST to GND twice.

param([string]$Drive = "")

$ErrorActionPreference = "Stop"

$uf2 = Join-Path $PSScriptRoot "firmware.uf2"
if (-not (Test-Path $uf2)) {
    Write-Host "No firmware.uf2 found. Run .\build.ps1 first." -ForegroundColor Red
    exit 1
}

if (-not $Drive) {
    $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO|FTHR840" } |
                 Select-Object -First 1
    if ($bootDrive) {
        $Drive = "$($bootDrive.DriveLetter):\"
        Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
    } else {
        # Try entering bootloader via serial command
        $port = [System.IO.Ports.SerialPort]::GetPortNames() | Select-Object -First 1
        if ($port) {
            Write-Host "Sending bootloader command to $port..." -ForegroundColor Cyan
            try {
                $serial = New-Object System.IO.Ports.SerialPort $port, 115200
                $serial.Open()
                $serial.Write("B")
                $serial.Close()
                Start-Sleep -Seconds 3
                # Re-check for bootloader drive
                $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO|FTHR840" } |
                             Select-Object -First 1
                if ($bootDrive) {
                    $Drive = "$($bootDrive.DriveLetter):\"
                    Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
                }
            } catch {
                Write-Host "Serial send failed: $_" -ForegroundColor Yellow
            }
        }
        if (-not $Drive) {
            Write-Host "No bootloader drive found." -ForegroundColor Yellow
            Write-Host "Short RST to GND twice on the SuperMini, then re-run." -ForegroundColor Yellow
            exit 1
        }
    }
}

Write-Host "Copying firmware.uf2 to $Drive ..." -ForegroundColor Cyan
Copy-Item $uf2 $Drive
Write-Host "Done! Board will reboot into new firmware." -ForegroundColor Green
