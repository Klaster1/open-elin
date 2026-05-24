# serial-buttons.ps1 — Interactive serial button trigger for the Zephyr pod
# Keys: u = shift up, d = shift down, B = enter bootloader, q = quit

param([string]$Port = "COM8", [int]$Baud = 115200)

$serial = New-Object System.IO.Ports.SerialPort $Port, $Baud
$serial.Open()

Write-Host "Connected to $Port @ $Baud" -ForegroundColor Green
Write-Host "  u = Shift Up    d = Shift Down    p = Pair    B = Bootloader    q = Quit" -ForegroundColor Cyan
Write-Host ""

try {
    while ($true) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true).KeyChar
            switch ($key) {
                'u' { $serial.Write("u"); Write-Host "-> Shift Up" -ForegroundColor Yellow }
                'd' { $serial.Write("d"); Write-Host "-> Shift Down" -ForegroundColor Yellow }
                'p' { $serial.Write("p"); Write-Host "-> Pairing Mode (10s)" -ForegroundColor Magenta }
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
    $serial.Close()
    Write-Host "`nSerial closed." -ForegroundColor Green
}
