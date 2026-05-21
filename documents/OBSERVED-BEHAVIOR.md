# NXS BikeNet — Observed Protocol & BLE Data

Protocol-level observations from real hardware: BLE advertisements, GATT profiles, notification frames, raw hex traces, button maps, hub configuration readouts. Computer-observable stuff only — for human-observable behavior (what you see when you press buttons), see `WHAT-YOU-SEE.md`.

Last updated: 2026-05-21.

---

## Devices

| Role | MAC | Name | Chip | Function |
|------|-----|------|------|----------|
| **Pod** | `D5:89:B2:13:FA:04` | `NXS MTB Pod` | nRF52832 QFAA QFN48 | Handlebar button unit — has physical buttons, no derailleur motor |
| **Hub** | `D7:BA:AB:52:A0:E5` | `NXS eLink hub` | — | Central unit — drives derailleur motor, communicates with pod via BLE (hub = central), with app/CLI via BLE (hub = peripheral) |

The pod is a **BLE peripheral** (advertiser). Directly observed advertising while hub was asleep (via nRF Connect). The hub is the **BLE central** — it initiates connections to the pod.

The app never directly connects to pods.

---

## Pod Advertisement (captured via noble scan, May 2026)

| Field | Value |
|-------|-------|
| Local name | `NXS MTB Pod` |
| Service UUIDs | *(none — not in advertisement)* |
| Manufacturer data | *(none)* |
| TX power level | 0 dBm |
| Service data | *(none)* |

The BikeNet service UUID does **not** appear in the pod's advertisement packet.

---

## Hub Advertisement (from btsnoop HCI capture)

| Field | Value |
|-------|-------|
| Service UUID | `A5C1C000-CC20-BA91-0C1A-EF3F9E643D79` |
| Manufacturer data | `ff 98 de 08 01 [hub MAC LE]` |
| Company ID | `0xDE98` |
| Payload prefix | `08 01` |

All BikeNet service UUID occurrences in `btsnoop_hci.log` come from the hub's own advertisement. No pod advertisement packets are present in the capture.

---

## Pod GATT Profile (confirmed via nRF Connect)

| Item | UUID |
|------|------|
| Service | `A5C1C000-CC20-BA91-0C1A-EF3F9E643D79` |
| MSG characteristic | `A5C1CC01-CC20-BA91-0C1A-EF3F9E643D79` (write + notify) |
| PIN characteristic | `A5C1CC02-CC20-BA91-0C1A-EF3F9E643D79` (write + notify) |

Direct GATT enumeration from PC (noble/WinRT) returned `Unreachable` — the pod drops connections from unrecognised/unbonded devices.

---

## Pod → Hub Notifications (observed via `hub monitor`, 2026-05-21)

All notifications use the same frame format on the MSG characteristic:
```
[00 00] [opcode 2 bytes LE] [target MAC 6 bytes LE] [payload...]
```

### Battery voltage — opcode `0x4000`

- Pod emits battery voltage **immediately on connection** (within ~100 ms of session start).
- Payload: 2-byte LE integer, millivolts.
- Observed: `2871 mV`, rawHex `370B` = `0x0B37` LE.

### Button action — opcode `0x4001`

- Payload: `[buttonId 1 byte] [actionFlag 1 byte]`
- `actionFlag`: `0x00` = Press, `0x01` = Release
- Hub forwards pod button events to app with `targetMac = pod MAC`.
- Both Press and Release are sent for each physical button press.

### Spurious button-0 Release on connect

- On every connection, the pod emits a Release of buttonId `0x00` with no preceding Press.
- Arrives ~120 ms after the battery voltage notification.
- Unknown if intentional ("I'm alive" signal) or firmware quirk.

### Shift-complete — opcode `0x4003`

- Emitted by the **hub** (targetMac = hub MAC) when a shift finishes.
- Observed payload: `1F 00 01` (3 bytes). Byte meaning unclear — `0x1F`=31 may be raw position, `0x01` may be gear index. Need more samples at different gears.

---

## Raw `hub monitor` Trace (2026-05-21T06:53 UTC)

Scenario: pod connected, single button press (A-1 = Shift Down), shift completes.

```jsonl
{"event":"battery-voltage","status":"success","code":16384,"targetMac":"D5:89:B2:13:FA:04","batteryVoltage":2871,"isHub":false,"rawHex":"370B","rawBytes":[55,11],"ts":"2026-05-21T06:53:08.597Z"}
{"event":"button-action","status":"success","code":16385,"targetMac":"D5:89:B2:13:FA:04","buttonId":0,"buttonHex":"00","buttonLabel":"-","actionFlag":1,"actionLabel":"Release","rawHex":"0001","rawBytes":[0,1],"ts":"2026-05-21T06:53:08.717Z"}
{"event":"button-action","status":"success","code":16385,"targetMac":"D5:89:B2:13:FA:04","buttonId":1,"buttonHex":"01","buttonLabel":"A-1","actionFlag":0,"actionLabel":"Press","rawHex":"0100","rawBytes":[1,0],"ts":"2026-05-21T06:53:09.316Z"}
{"event":"button-action","status":"success","code":16385,"targetMac":"D5:89:B2:13:FA:04","buttonId":1,"buttonHex":"01","buttonLabel":"A-1","actionFlag":1,"actionLabel":"Release","rawHex":"0101","rawBytes":[1,1],"ts":"2026-05-21T06:53:09.497Z"}
{"event":"shift-complete","status":"success","code":16387,"targetMac":"D7:BA:AB:52:A0:E5","payloadValue":65567,"rawHex":"1F0001","rawBytes":[31,0,1],"ts":"2026-05-21T06:53:10.096Z"}
```

### Timing (relative to battery-voltage at T=0)

| T (ms) | Event |
|--------|-------|
| 0 | Battery voltage (2871 mV) |
| +120 | Spurious button-0 Release |
| +719 | A-1 Press (user button) |
| +900 | A-1 Release |
| +1499 | Shift-complete |

---

## Notification Frame Format `[inferred]`

The hub forwards pod events to the app verbatim with `targetMac = pod MAC`. This strongly implies the pod itself sends the same frame format:

**Button action:**
```
[00 00] [01 40] [pod MAC 6 bytes LE] [buttonId 1 byte] [actionFlag 1 byte]
```

**Battery voltage:**
```
[00 00] [00 40] [pod MAC 6 bytes LE] [mV 2 bytes LE]
```

---

## Button Map (read from hub after proper app pairing, 2026-05-21)

Pod `04FA13B289D5` ↔ hub `E5A052ABBAD7`. 7 entries, all action=Press:

| Index | Button code | Label | Function code | Function |
|-------|------------|-------|---------------|----------|
| 0 | `0x00` | `-` | `0x0A` | Shift Up |
| 1 | `0x06` | B | `0x0B` | Shift Down |
| 2 | `0x0C` | C | `0x11` | Tune Mode |
| 3 | `0x0D` | C-1 | `0x0A` | Shift Up |
| 4 | `0x01` | A-1 | `0x0B` | Shift Down |
| 5 | `0x12` | D | `0x0B` | Shift Down |
| 6 | `0x02` | A-2 | `0x11` | Tune Mode |

Button codes the pod emits: `0x00`, `0x01`, `0x02`, `0x06`, `0x0C`, `0x0D`, `0x12`.

Labels (A-1, A-2, B, C, C-1, D) correspond to PORT_A/B/C/D wiring. Two codes per port (e.g. A-1=`0x01`, A-2=`0x02`) = two buttons per port connector.

**Without a button map written to the hub, button presses are silently ignored.** Confirmed: before app pairing, `entryCount:0` → no response to button presses.

---

## Pairing / Connection — Protocol Details (verified 2026-05-21)

**Add pod:**
```
hub add-device --address <hub-mac> --timeout 15000 <pod-mac>
```
- Hub scans for pod by BLE local name `NXS MTB Pod` (not by service UUID).
- Hub bonds to pod.
- Hub notification: `0x8006` (new bond) or `0x8007` (reconnect if already bonded).
- Returns `0x8003` (INVALID_STATE) if pod already in hub's list — benign.

**Write button map:**
```
hub write-button-map --address <hub-mac> --use-captured
```
Maps pod button codes to shift/tune actions (7 entries). Without this, hub silently ignores all pod button presses.

### Hub discovery mechanism

The hub finds the pod by **BLE local name** (`NXS MTB Pod`), not by service UUID. Confirmed by successful `add-device` with a pod whose advertisement contains no service UUIDs.

---

## Hub Configuration State (read 2026-05-21)

| Parameter | Value |
|-----------|-------|
| Rear cog | 12-speed, positions 1–23 (odd), teeth 11–32 |
| Motor: stall detection | 2300 |
| Motor: PWM frequency | 50000 |
| Motor: acceleration | 30 |
| Motor: overshift distance | 0.4 |
| Motor: overshift delay | 500 |
| Motor: multishift delay | 200 |
| Position (after one shift-down) | absolutePosition: 3, gearPosition: 2 |

---

## Open Questions (things NOT yet observed)

- Hub↔pod wire format: what the hub sends to the pod over MSG/PIN characteristics
- Whether the hub relays any app commands to the pod
- Connection parameters (interval, MTU)
- What triggers the pod to send `BLE_MSG_BAT_V` (on connect only? periodic? threshold?)
- Button sensing mechanism (ADC resistor ladder? digital GPIO?)
- Whether the pod tracks any state (e.g. tune mode) or all state lives on the hub
- Shift-complete payload byte meanings (`1F 00 01`)
- How the hub discovers pods in its own auto-pairing mode (hub button held)
- Whether manufacturer-specific advertisement data is required
- PIN auth behavior (default `0000`, never enforced — but not tested what happens with wrong PIN)
