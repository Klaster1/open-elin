# Build, convert to UF2, and flash the firmware via USB bootloader.
# Usage: .\flash.ps1
#   Fully automated after Task 1 — sends 'b' over serial to enter bootloader.
#   For Task 0 (no serial yet): use -Drive E:\ after manually entering bootloader.

param(
    [string]$Drive = "",
    [switch]$NoSerial
)

$ErrorActionPreference = "Stop"

Write-Host "Building firmware..." -ForegroundColor Cyan
cargo build --release
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Converting to binary..." -ForegroundColor Cyan
cargo objcopy --release -- -O binary firmware.bin
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Converting to UF2..." -ForegroundColor Cyan
uf2conv -b 0x1000 -f 0x239A00B3 -o firmware.uf2 firmware.bin
if ($LASTEXITCODE -ne 0) { exit 1 }

# Enter bootloader via serial command (Task 1+)
if (-not $NoSerial -and -not $Drive) {
    $port = [System.IO.Ports.SerialPort]::GetPortNames() | Select-Object -First 1
    if ($port) {
        Write-Host "Sending bootloader command to $port..." -ForegroundColor Cyan
        $serial = New-Object System.IO.Ports.SerialPort $port, 115200
        $serial.Open()
        $serial.Write("b")
        $serial.Close()
        Write-Host "Waiting for bootloader drive..." -ForegroundColor Cyan
        $timeout = 10
        for ($i = 0; $i -lt $timeout; $i++) {
            Start-Sleep -Seconds 1
            $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO" } |
                         Select-Object -First 1
            if ($bootDrive) { break }
        }
        if (-not $bootDrive) {
            Write-Host "Bootloader drive did not appear. Try -NoSerial and manual RST short." -ForegroundColor Red
            exit 1
        }
        $Drive = "$($bootDrive.DriveLetter):\"
        Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
    } else {
        Write-Host "No COM port found. Is the board connected?" -ForegroundColor Red
        exit 1
    }
}

# Auto-detect bootloader drive if not specified
if (-not $Drive) {
    $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO" } |
                 Select-Object -First 1
    if ($bootDrive) {
        $Drive = "$($bootDrive.DriveLetter):\"
        Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Short RST to GND twice on the SuperMini, then re-run:" -ForegroundColor Yellow
        Write-Host "  .\flash.ps1 -Drive D:\" -ForegroundColor Yellow
        Write-Host "(replace D: with whatever drive letter appears)" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Copying firmware.uf2 to $Drive ..." -ForegroundColor Cyan
Copy-Item firmware.uf2 $Drive
Write-Host "Done! Board will reboot into new firmware." -ForegroundColor Green
