# serial-buttons.ps1 — Interactive serial button trigger for the Zephyr pod
# Keys: u = shift up, d = shift down, B = enter bootloader, q = quit

param([string]$Port = "COM8", [int]$Baud = 115200)

function Connect-Serial {
    param([string]$Port, [int]$Baud)
    $s = New-Object System.IO.Ports.SerialPort $Port, $Baud
    $s.Open()
    return $s
}

function Show-Banner {
    Write-Host "  u = Shift Up    d = Shift Down    t = Tune    p = Wake" -ForegroundColor Cyan
    Write-Host "  P = Pair        S = Sleep         L = Relax Latency" -ForegroundColor Cyan
    Write-Host "  0-9 = Sim Battery (0=dead 5=mid 9=full)    v = Read Battery" -ForegroundColor Cyan
    Write-Host "  F = Flash       B = Bootloader    q = Quit" -ForegroundColor Cyan
    Write-Host ""
}

$serial = Connect-Serial $Port $Baud
Write-Host "Connected to $Port @ $Baud" -ForegroundColor Green
Show-Banner

try {
    while ($true) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true).KeyChar
            $keyInt = [int]$key
            Write-Host "[key: '$key' (0x$($keyInt.ToString('X2')))]" -ForegroundColor DarkGray -NoNewline
            Write-Host " " -NoNewline
            switch -CaseSensitive ($key) {
                'u' { $serial.Write("u"); Write-Host "-> Shift Up" -ForegroundColor Yellow }
                'd' { $serial.Write("d"); Write-Host "-> Shift Down" -ForegroundColor Yellow }
                't' { $serial.Write("t"); Write-Host "-> Tune Toggle" -ForegroundColor Yellow }
                'p' { $serial.Write("p"); Write-Host "-> Wake Radio" -ForegroundColor Green }
                'P' { $serial.Write("P"); Write-Host "-> Pairing Mode (10s)" -ForegroundColor Magenta }
                'S' { $serial.Write("S"); Write-Host "-> Radio Sleep" -ForegroundColor DarkYellow }
                'L' { $serial.Write("L"); Write-Host "-> Relax Latency" -ForegroundColor DarkCyan }
                'v' { $serial.Write("v"); Write-Host "-> Read Battery" -ForegroundColor Cyan }
                { $_ -match '[0-9]' } { $serial.Write([string]$key); Write-Host "-> Sim Battery level $key" -ForegroundColor Cyan }
                'F' {
                    Write-Host "-> Flash" -ForegroundColor Cyan
                    $uf2 = Join-Path $PSScriptRoot "firmware.uf2"
                    if (-not (Test-Path $uf2)) {
                        Write-Host "No firmware.uf2 found! Run build first." -ForegroundColor Red
                        continue
                    }
                    # 1. Enter bootloader
                    Write-Host "Entering bootloader..." -ForegroundColor Cyan
                    $serial.Write("B")
                    Start-Sleep -Milliseconds 500
                    $serial.Close()
                    # 3. Wait for bootloader drive
                    $uf2 = Join-Path $PSScriptRoot "firmware.uf2"
                    $drive = $null
                    for ($i = 0; $i -lt 20; $i++) {
                        Start-Sleep -Milliseconds 500
                        $vol = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO|FTHR840" } | Select-Object -First 1
                        if ($vol) { $drive = "$($vol.DriveLetter):\"; break }
                    }
                    if (-not $drive) {
                        Write-Host "Bootloader drive not found! Double-tap RST manually." -ForegroundColor Red
                    } else {
                        Write-Host "Flashing to $drive ..." -ForegroundColor Cyan
                        Copy-Item $uf2 $drive
                        Write-Host "Flashed! Waiting for reboot..." -ForegroundColor Green
                    }
                    # 4. Wait for serial port to reappear
                    $reconnected = $false
                    for ($i = 0; $i -lt 30; $i++) {
                        Start-Sleep -Milliseconds 500
                        try {
                            $serial = Connect-Serial $Port $Baud
                            $reconnected = $true
                            break
                        } catch {
                            # port not ready yet
                        }
                    }
                    if ($reconnected) {
                        Write-Host "Reconnected to $Port" -ForegroundColor Green
                        Show-Banner
                    } else {
                        Write-Host "Could not reconnect to $Port — restart script manually" -ForegroundColor Red
                        break
                    }
                }
                'B' { $serial.Write("B"); Write-Host "-> Bootloader (bye!)" -ForegroundColor Red; break }
                'q' { break }
            }
            if ($key -eq 'q' -or $key -eq 'B') { break }
        }
        # Print any serial output from the pod
        if ($serial.BytesToRead -gt 0) {
            $text = $serial.ReadExisting()
            Write-Host $text -NoNewline -ForegroundColor DarkGray
        }
        Start-Sleep -Milliseconds 50
    }
} finally {
    if ($serial.IsOpen) { $serial.Close() }
    Write-Host "`nSerial closed." -ForegroundColor Green
}
