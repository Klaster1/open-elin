# NXS Pod Firmware (Zephyr C)

Replacement pod firmware for **SuperMini nRF52840** using Zephyr RTOS.
Emulates an NXS BikeNet pod so the hub can connect, pair, and shift gears.

## Hardware

- **Board:** SuperMini nRF52840 (nice_nano clone)
- **Bootloader:** Adafruit UF2 (nice_nano variant), lives at `0xF4000`
- **LED:** P0.15, active high
- **SWD pads (bottom of PCB):** VDD, DIO, CLK, GND
- **BLE address:** `F7:3A:3D:75:99:A0`

## Prerequisites

- Docker (the Zephyr SDK is baked into a ~29 GB image)
- One-time image build: `docker build -t nxs-zephyr .`

## Build

```powershell
.\build.ps1
```

Runs `docker run` → produces `firmware.uf2` in this directory.

**Important:** The Docker image uses `--entrypoint bash` internally. If running `docker run` manually, use `--entrypoint bash` to override the baked-in ENTRYPOINT.

## Flash

Enter the UF2 bootloader (double-tap RST to GND, or send `B` over serial), then:

```powershell
.\flash.ps1
```

Or manually: `Copy-Item firmware.uf2 E:\`

## Serial Commands

Connect to the USB CDC COM port at 115200 baud:

| Key | Action |
|-----|--------|
| `u` | Shift up (button 0x00 press+release) |
| `d` | Shift down (button 0x01 press+release) |
| `B` | Reboot into UF2 bootloader |

## Hub Setup

After flashing, the pod advertises as "NXS MTB Pod". To use with the hub:

```powershell
# 1. Add pod to hub
npm run cli -- hub add-device --address D7:BA:AB:52:A0:E5 --wait-for-pod 30 F7:3A:3D:75:99:A0

# 2. Write button map (required — hub won't shift without it)
npm run cli -- hub write-default-button-map --pod-mac F7:3A:3D:75:99:A0 --address D7:BA:AB:52:A0:E5

# 3. Test shifting
.\serial-buttons.ps1
```

## Protocol Tests

The protocol module (`src/protocol.c`) has no Zephyr dependencies and is tested on the host:

```powershell
cd tests
make test    # requires gcc (e.g. via MSYS2, WSL, or Docker)
```

## Architecture

```
src/
├── main.c       # Entry point, BLE advertising, serial input, connection lifecycle
├── gatt.c/h     # BikeNet GATT service (MSG + PIN characteristics)
├── protocol.c/h # Frame encoding/decoding (portable C, no Zephyr deps)
```

- **BLE stack:** Zephyr's built-in BLE (no SoftDevice)
- **Pairing:** `CONFIG_BT_SMP=y` — hub bonds during `add-device`
- **No NVS/flash persistence** — bonds are not saved. Hub re-pairs on each power cycle via `add-device`. This is fine because the CircuitPython pod worked the same way.
- **LED:** Blinks briefly (50ms) on GATT activity (button send, ShiftComplete, PIN exchange)
- **Power:** `CONFIG_PM=y`, CPU sleeps between BLE events. Battery reported every 5s as fixed 3000 mV.

## SWD Recovery

If the bootloader is corrupted (e.g. by accidental flash writes to `0xF4000`+), recover via SWD:

1. Use a WCH-Link in DAP mode (switch via WCH-LinkUtility)
2. Wire: DIO→SWDIO, CLK→SWDCLK, GND→GND, VDD→3V3
3. Download `nice_nano_bootloader-*_s140_6.1.1.hex` from [Adafruit nRF52 Bootloader releases](https://github.com/adafruit/Adafruit_nRF52_Bootloader/releases)
4. Flash with OpenOCD:

```powershell
& "tools\pod-firmware\openocd\bin\openocd.exe" `
  -s "tools\pod-firmware\openocd\share\openocd\scripts" `
  -f interface/cmsis-dap.cfg -f target/nordic/nrf52.cfg `
  -c "init; nrf52_recover; reset halt; program {nice_nano_bootloader.hex} verify; reset; exit"
```

## Critical Lessons

- **Never enable NVS/flash/settings on this board.** The `adafruit_feather_nrf52840` DTS has no `storage_partition` for internal flash. NVS will write to undefined flash regions and corrupt the bootloader.
- **`CONFIG_BT_SMP=y` is sufficient** for hub pairing — no bond persistence needed.
- **Memory layout:** MBR (0x0000–0x1000) → App (0x1000–0xF4000) → Bootloader (0xF4000–0x100000). Don't touch anything at 0xF4000+.
