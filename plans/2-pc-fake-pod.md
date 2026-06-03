# Plan 2 — Fake Pod (nRF52840 SuperMini, CircuitPython)

## Goal

A CircuitPython BLE peripheral on an nRF52840 SuperMini that impersonates an NXS BikeNet pod. Hub connects to it; physical button on the board sends shift-up. We log every byte the hub writes via USB serial.

**Repo:** `c:\dev\nxs\firmware-pod`
**Hardware:** SuperMini NRF52840 · CircuitPython 9.2.8
**Board drive:** `E:\` (auto-mounted as USB mass storage)
**Button pin:** `board.P0_17` (pull-up, active-low)
**LED pin:** `board.LED`

---

## Why not macOS/bleno

macOS CoreBluetooth peripheral mode (`startAdvertising:`) silently drops `CBAdvertisementDataManufacturerDataKey`. The hub scanner (`DeviceMetadata.fromByteArray()` in the APK) returns `null` for devices with no manufacturer data, so the hub never connects regardless of MAC or service UUID. Confirmed by zero incoming-connection events in the macOS BT system log during `hub add-device`.

nRF52840 via CircuitPython `_bleio.adapter.start_advertising(raw_bytes)` accepts raw AD-structure bytes, letting us include the required manufacturer data record.

---

## What we're trying to find out

| Question | Status | Experiment |
|----------|--------|------------|
| How does hub discover pods (CLI flow)? | ✅ **RESOLVED** — `hub add-device <mac>` tells the hub to connect to a specific MAC address. | Confirmed: real pod connected by MAC 2026-05-21 |
| Button notify format (pod→hub)? | ✅ **RESOLVED** — `[00 00][01 40][pod MAC 6B LE][buttonId][actionFlag]` | Captured via `hub monitor` 2026-05-21 |
| Battery notify format (pod→hub)? | ✅ **RESOLVED** — `[00 00][00 40][pod MAC 6B LE][mV LE16]` | Captured via `hub monitor` 2026-05-21 |
| Does hub send a PIN unlock to the pod? | ❓ | Observe first write after connection |
| What does hub write on connection init (opcode, payload)? | ❓ | Log all MSG + PIN char writes via serial |
| What does hub write when a shift or app command references the pod? | ❓ | Use open-elin-cli + app while hub is connected to fake pod |
| Does hub expect a specific ACK/response to stay connected? | ❓ | Log disconnects; try replying to writes |

---

## Technology

### BLE: CircuitPython `_bleio` (built-in, no download needed)

`_bleio` is CircuitPython's built-in BLE module. `adafruit_ble` is just a wrapper around it.
We use `_bleio` directly because `adapter.start_advertising(raw_bytes)` lets us include manufacturer data (AD type `0xFF`) which is required by the hub scanner.

- No library bundle needed — zero files to copy to `E:\lib\`
- Full control over advertisement AD structure
- `CharacteristicBuffer` for queue-based detection of hub writes
- `Characteristic.value = data` sends NOTIFY to subscribed centrals automatically

### Advertisement format (critical — hub scanner requires this)

Hub scanner filters by manufacturer data. Advertisement must include:

| AD type | Bytes | Meaning |
|---------|-------|---------|
| `0x09` | `4E 58 53 20 4D 54 42 20 50 6F 64` | Complete Local Name = `NXS MTB Pod` |
| `0x07` | `79 3d 64 9e 3f ef 1a 0c 91 ba 20 cc 00 c0 c1 a5` | Complete 128-bit UUID (service UUID LE) |
| `0xFF` | `98 de 08 01 e5 a0 52 ab ba d7` | Manufacturer specific: company `0xDE98` LE + `0x08 0x01` + hub MAC LE |

Hub MAC `d7:ba:ab:52:a0:e5` → LE bytes `[0xe5, 0xa0, 0x52, 0xab, 0xba, 0xd7]`.

### GATT service

| Attribute | UUID | Properties |
|-----------|------|------------|
| Service | `a5c1c000-cc20-ba91-0c1a-ef3f9e643d79` | — |
| MSG char | `a5c1cc01-…` | WRITE + NOTIFY |
| PIN char | `a5c1cc02-…` | WRITE + NOTIFY |

PIN exchange: hub writes PIN to `pin_char` → fake pod replies `0x01` (accepted).

### Physical button

`board.P0_17`, pull-up resistor, active-low. Falling edge → send shift-UP notification (`buttonId = 0x06`) on MSG char. 50 ms debounce.

### Serial output

USB CDC console (`usb_cdc.enable(console=True)`). Every hub write, PIN exchange, and button press logged to serial as plain text. Connect any serial terminal at any baud (CircuitPython auto-detects).

---

## Directory structure

```
firmware-pod/
  boot.py       ← USB config: disable HID, keep CDC serial
  code.py       ← main fake pod (copy both to E:\)
```

Copy to board:
```powershell
Copy-Item code.py E:\code.py -Force
Copy-Item boot.py E:\boot.py -Force
```

---

## Implementation checklist

### Done

- [x] `boot.py` — `usb_hid.disable()` + `usb_cdc.enable(console=True, data=False)` — no more TypeError on boot
  ✔ Deployed to `E:\boot.py`
- [x] `code.py` — full fake pod: manufacturer-data advertisement, GATT service, PIN ACK, button → shift-UP, serial logging
  ✔ Deployed to `E:\code.py`

### Verification — connect to hub

- [ ] Open serial terminal (PuTTY / screen / Arduino Serial Monitor at any baud on the board's COM port)
  ✔ Verify: `NXS pod emulator starting …` and `Advertising 'NXS MTB Pod'  addr=XX:XX:XX:XX:XX:XX` appear on power-up
- [ ] Note the board BLE address printed on serial (format `XX:XX:XX:XX:XX:XX`)
  ✔ Verify: address logged to console
- [ ] Run `hub add-device`:
  ```powershell
  node cli/src/cli.ts hub add-device --address d7:ba:ab:52:a0:e5 --timeout 15000 --wait-for-pod 30 <BOARD-MAC>
  ```
  ✔ Verify: `0x8006` (POD_CONNECTED_NEW) received by CLI; `hub list` shows board MAC alongside real pod

### Verification — button → shift

- [ ] Press physical button on `P0_17`
  ✔ Verify serial output: `→ button 0x06  payload 0000014004faXXXXXX0600`
- [ ] **Derailleur moves physically**
  ✔ And/or `hub monitor` shows `0x4003` shift-complete attributed to board MAC

### Observation — hub→pod writes

- [ ] Read serial log for `← PIN` lines after connection
  ✔ Verify: PIN data logged; `→ ACK 0x01` sent
- [ ] Read serial log for `← MSG` lines — these reveal hub→pod init sequence opcodes
  ✔ Verify: at least one non-zero MSG write logged after pairing completes

---

## Serial log format

Plain text, one event per line:

```
NXS pod emulator starting …
Advertising 'NXS MTB Pod'  addr=DE:AD:BE:EF:CA:FE
← PIN  010101  →  ACK 0x01
← MSG  00000900...
→ button 0x06  payload 0000014004faDEADBEEFCAFE0600
```

---

## Success criteria

- [ ] Board advertises with correct manufacturer data; hub scanner finds it
- [ ] Hub connects after `hub add-device <board-mac>`
- [ ] `hub list` shows board MAC
- [ ] PIN exchange logged (hub writes PIN → board replies `0x01`)
- [ ] All hub→MSG writes logged with raw hex
- [ ] Button press sends shift-UP; **derailleur moves physically**
- [ ] Enough data captured to describe the hub→pod connection-init sequence

---

## Known unknowns (to be resolved by experiments)

- Does the hub send a PIN auth write to the pod? (likely no — PIN was never enforced in testing with real pod)
- What is the first opcode the hub writes to a freshly-paired pod?
- Does the hub write anything when app-side or CLI gear commands are issued?
- Does the hub expect a response to stay connected, or is it fire-and-forget?

## Already resolved (no longer need fake pod for these)

- **Hub connection mechanism**: `hub add-device <mac>` connects by MAC address; name/service UUID in advertisement are irrelevant for connectivity — confirmed 2026-05-21
- **Button notify format**: `[00 00][01 40][pod MAC 6B LE][buttonId][actionFlag]` — captured via `hub monitor` 2026-05-21
- **Battery notify format**: `[00 00][00 40][pod MAC 6B LE][mV LE16]` — captured 2026-05-21
- **Why Mac/bleno failed**: CoreBluetooth ignores `CBAdvertisementDataManufacturerDataKey` in `startAdvertising:` → hub scanner returns null → hub never dials the Mac — confirmed by macOS BT system log showing zero connection events during `hub add-device`
