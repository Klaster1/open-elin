# NXS BikeNet — Observed Protocol & BLE Data

Protocol-level observations from real hardware: BLE advertisements, GATT profiles, notification frames, raw hex traces, button maps, hub configuration readouts. Computer-observable stuff only — for human-observable behavior (what you see when you press buttons), see `WHAT-YOU-SEE.md`.

Last updated: 2026-05-22.

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

- Emitted by the **hub** as a notification on the **hub's** MSG characteristic (targetMac = hub MAC). The CLI/app receives this by subscribing to the hub's MSG notifications — it is NOT observed as a hub→pod write.
- Whether the hub also writes ShiftComplete to the **pod's** MSG characteristic is **unverified** — see "Hub → Pod Communication" section below.
- Payload: 3 bytes. High byte (byte 10 in the full frame) = **0-indexed gear number**. Confirmed by cross-referencing with Position notifications:
  - `1F 00 01` → gear index 1 → gearPosition 2
  - `97 00 07` → gear index 7 → gearPosition 8
  - `83 00 06` → gear index 6 → gearPosition 7
- Low two bytes (`1F 00`, `97 00`, `83 00`, `84 00`, `80 00`) appear to encode an absolute motor position. In tune mode, only these bytes change (small deltas); in shift mode, the high byte changes by ±1 and the low bytes reset to a new position.

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

Button codes appearing **in the default map**: `0x00`, `0x01`, `0x02`, `0x06`, `0x0C`, `0x0D`, `0x12`.

Button codes **actually emitted by this pod** (verified 2026-05-22 — see next section): only `0x00`, `0x01`, `0x02`. The other four (`0x06 B`, `0x0C C`, `0x0D C-1`, `0x12 D`) are inert — the default map ships them to cover multi-switch pod variants that don't exist on our hardware.

Labels (A-1, A-2, B, C, C-1, D) correspond to PORT_A/B/C/D wiring. Two codes per port (e.g. A-1=`0x01`, A-2=`0x02`) = two buttons per port connector.

### Button code → port address space `[inferred from BUTTON_LABELS in decompiled app]`

Each port gets a block of 6 codes: one base code plus sub-buttons `-1` through `-5`. The `-` label (`0x00`) sits before the first port range.

| Range         | Codes           | Port | Labels                              | This pod? |
|---------------|-----------------|------|-------------------------------------|-----------|
| `0x00`        | `0x00`          | —    | `-` (base / direction button)       | **yes** — emits on physical press |
| `0x01–0x05`   | `0x01`–`0x05`   | A    | A-1, A-2, A-3, A-4, A-5            | **yes** — A-1 (direction), A-2 (mode toggle) confirmed; A-3 through A-5 never observed |
| `0x06–0x0B`   | `0x06`–`0x0B`   | B    | B, B-1, B-2, B-3, B-4, B-5         | no — no switches on port B |
| `0x0C–0x11`   | `0x0C`–`0x11`   | C    | C, C-1, C-2, C-3, C-4, C-5         | no — no switches on port C |
| `0x12–0x17`   | `0x12`–`0x17`   | D    | D, D-1, D-2, D-3, D-4, D-5         | no — no switches on port D |

Total address space: 24 codes (`0x00`–`0x17`). The hub's default map only populates 7 of these (one per port base + one or two sub-buttons), but a custom map could assign any code in this range.

The pod PCB has connector pads for ports A–D but only port A has switches soldered on our `NXS MTB Pod`. A multi-button pod (road, gravel) would populate additional ports and emit codes from their ranges.

**Without a button map written to the hub, button presses are silently ignored.** Confirmed: before app pairing, `entryCount:0` → no response to button presses.

---

## Button Behavior — physical buttons, modes, and effects (verified 2026-05-22)

Captured by subscribing to `Button action` + `Shift complete` + `Position` notifications and pressing each physical button on the real pod in a known sequence (shift down/up, toggle tune, nudge ±, toggle back).

**Codes emitted by this pod (only these three):**

| Byte | Label | Physical role             | Action notifications |
|------|-------|---------------------------|----------------------|
| `0x00` | `-`   | direction button (paired with `0x01`) | press + release |
| `0x01` | `A-1` | direction button (paired with `0x00`) | press + release |
| `0x02` | `A-2` | mode toggle (shift ↔ tune)            | press + release |

**Hub-side interpretation depends on mode:**

| Mode  | `A-1` (`0x01`) | `-` (`0x00`) | `A-2` (`0x02`) |
|-------|---------------|--------------|----------------|
| shift | shift one gear, `gearPosition` changes by 1 | shift one gear, opposite direction | toggle to tune mode, **no** `Shift complete` emitted |
| tune  | nudge motor offset by small amount; `gearPosition` unchanged | nudge opposite direction; `gearPosition` unchanged | toggle back to shift mode, no `Shift complete` |

**Mode is hub-side state.** The pod sends the same byte regardless of mode. `A-2` press only flips the hub's internal `tune-mode` flag; it never triggers a `Shift complete`. (`Shift complete` is emitted on every shift-mode direction press and every tune-mode nudge press, but never on a mode toggle.)

**Action byte:** the low byte of `rawHex` is `00` for press and `01` for release. Both are transmitted on every physical press; the hub acts on the press. Example: `rawHex: "0100"` = A-1 press, `"0101"` = A-1 release.

**Tune-mode step size:** in one capture, `A-1` (held 124 ms) moved the raw `Shift complete` payload by +1 unit, while `-` (held 248 ms) moved it by −4 units. This suggests hold-to-repeat semantics in tune mode rather than a fixed step per tap, but the per-press step has not been isolated yet — one more capture with brief taps would confirm.

**Implication for the default map:** of the 7 default-map rows, only 3 are exercised by this pod (the rows for `0x00 → Shift Up`, `0x01 → Shift Down`, `0x02 → Tune Mode`). The remaining 4 rows (`0x06 B → Shift Down`, `0x0C C → Tune Mode`, `0x0D C-1 → Shift Up`, `0x12 D → Shift Down`) are inert — the hub maps them dutifully but the pod never sends those codes. This is why the "Buttons" screen appears to list the same action twice: each duplicate row is a fallback for a button this pod doesn't have.

**Direction labelling:** the hub function names ("Shift Up" / "Shift Down") don't necessarily line up with bike-convention "harder/easier gear" or with the displayed `gearPosition` direction — observed `A-1` (`0x01 → Shift Down` per map) caused `gearPosition` 7 → 8, while `-` (`0x00 → Shift Up`) caused 8 → 7. So "Shift Down" function = `gearPosition += 1`, "Shift Up" function = `gearPosition -= 1` for this hub/cog combination. Whether that corresponds to upshift or downshift mechanically depends on the rear cog ordering and is not encoded in the protocol — it's just a convention.

### Raw trace (2026-05-22T09:23–09:24 local)

Performed sequence: (1) shift up/down in shift mode, (2) press `A-2` to toggle into tune mode, (3) tweak with `A-1` and `-`, (4) press `A-2` to toggle back.

```
[09:23:53.864] Button action { buttonLabel: "A-1", actionLabel: "Press",   rawHex: "0100" }
[09:23:53.983] Button action { buttonLabel: "A-1", actionLabel: "Release", rawHex: "0101" }
[09:23:55.062] Shift complete { payloadValue: 458903, rawHex: "970007" }
[09:23:55.782] Position      { absolutePosition: 15,   gearPosition: 8 }

[09:23:55.784] Button action { buttonLabel: "-",   actionLabel: "Press",   rawHex: "0000" }
[09:23:55.785] Button action { buttonLabel: "-",   actionLabel: "Release", rawHex: "0001" }
[09:23:56.322] Shift complete { payloadValue: 393347, rawHex: "830006" }
[09:23:56.682] Position      { absolutePosition: 13.2, gearPosition: 7 }

# --- A-2 press: silent toggle into tune mode (no Shift complete) ---
[09:24:04.064] Button action { buttonLabel: "A-2", actionLabel: "Press",   rawHex: "0200" }
[09:24:04.122] Button action { buttonLabel: "A-2", actionLabel: "Release", rawHex: "0201" }

# --- A-1 in tune mode: nudge, gearPosition unchanged ---
[09:24:06.524] Button action { buttonLabel: "A-1", actionLabel: "Press",   rawHex: "0100" }
[09:24:06.642] Shift complete { payloadValue: 393348, rawHex: "840006" }
[09:24:06.648] Button action { buttonLabel: "A-1", actionLabel: "Release", rawHex: "0101" }
[09:24:06.763] Position      { absolutePosition: 13.2, gearPosition: 7 }

# --- "-" in tune mode: nudge opposite direction, gearPosition unchanged ---
[09:24:07.902] Button action { buttonLabel: "-",   actionLabel: "Press",   rawHex: "0000" }
[09:24:08.142] Shift complete { payloadValue: 393344, rawHex: "800006" }
[09:24:08.150] Button action { buttonLabel: "-",   actionLabel: "Release", rawHex: "0001" }
[09:24:08.383] Position      { absolutePosition: 12.8, gearPosition: 7 }

# --- A-2 press: silent toggle back to shift mode ---
[09:24:11.505] Button action { buttonLabel: "A-2", actionLabel: "Press",   rawHex: "0200" }
[09:24:11.516] Button action { buttonLabel: "A-2", actionLabel: "Release", rawHex: "0201" }
```

`payloadValue` of `Shift complete` is the same 3 bytes as the position `rawHex`, parsed LE — i.e. it's the absolute motor position, not a per-shift delta:

| Event                | `rawHex`   | payload (LE u24) | hex     | abs  | gear |
|----------------------|------------|------------------|---------|------|------|
| A-1 in shift         | `970007`   | 458903           | 0x070097 | 15.0 | 8    |
| `-` in shift         | `830006`   | 393347           | 0x060083 | 13.2 | 7    |
| A-1 in tune  (+1)    | `840006`   | 393348           | 0x060084 | 13.2 | 7    |
| `-` in tune  (−4)    | `800006`   | 393344           | 0x060080 | 12.8 | 7    |

So one shift-mode press = ±1 in the high byte (gear index) + larger reset of the low bytes; one tune-mode press = small change in the low bytes only. Same byte code (`0x00` / `0x01`) from the pod, completely different motor behavior based on the hub-side tune flag.

---

## BLE_CMD_DISCONNECT_DEVICE (0x0007) — tested 2026-05-22

**Command:** `hub disconnect-device --address D7:BA:AB:52:A0:E5 D5:89:B2:13:FA:04`

**Observed:** Hub connected successfully (BLE GATT characteristics discovered), command payload sent, but the hub returned **no response** — command timed out waiting for a reply. After the attempt, `hub list` confirmed the pod was still listed as `isConnected: true`. The pod was in range throughout and continued functioning normally (button presses still triggered shifts).

**Ruling out:** Pod-not-in-range and hub-disconnects-pod-before-ACK are both ruled out — the pod was live and the connection survived.

**Remaining hypotheses:**
- 0x0007 is fire-and-forget on the hub side (no ACK sent), unlike all other command opcodes.
- 0x0007 is not implemented / silently ignored by this firmware version.
- 0x0007 requires a precondition (e.g. a specific hub state or a prior command) before it takes effect.

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

## Hub → Pod Communication (unverified)

The hub acts as BLE central to the pod. All confirmed observations are of the **hub→app** direction (CLI subscribes to the hub's MSG characteristic and receives notifications). The **hub→pod** direction — whether the hub writes data to the pod's MSG or PIN characteristics — has never been directly captured.

**What we know:**
- The hub writes to the pod's **PIN** characteristic during pairing (observed: CirPy receives PIN data via `pin_buf`/`pin_char.value` and responds with ACK `0x01`).
- The hub presumably writes **something** to the pod after connection setup (connection bonding, CCCD subscription). But no protocol-level data has been captured for this.

**What we now know (verified 2026-05-24 with Zephyr C firmware):**
- The hub does **NOT** write ShiftComplete (`0x4003`) — or anything else — to the pod's MSG characteristic after a shift. The Zephyr firmware logs all GATT writes via `LOG_HEXDUMP_INF` and no `MSG write` output appeared after button presses that successfully triggered shifts on the hub. The ShiftComplete parsing code in both CirPy and Zephyr firmware is **dead code**.
- The hub does **not** write any other commands to the pod's MSG characteristic during normal operation (connect → button presses → disconnect cycle).

**What we DON'T know:**
- Whether the hub relays app commands (e.g. position queries, config changes) to the pod.

**CirPy's direction-flipping mechanism:** The CirPy fake pod uses a **1.2-second timeout** as the primary direction-flip mechanism. If no ShiftComplete arrives within 1.2s of a button press, it assumes a gear limit was hit and reverses direction. This timeout path is the **only working mechanism** — the ShiftComplete parsing path is dead code.

---

## Open Questions (things NOT yet observed)

- ~~Hub→pod wire format: **does the hub write ShiftComplete (0x4003) to the pod's MSG characteristic?**~~ **No.** Verified 2026-05-24 — hub never writes to pod MSG after shifts.
- Whether the hub relays any app commands to the pod
- Connection parameters (interval, MTU)
- What triggers the pod to send `BLE_MSG_BAT_V` (on connect only? periodic? threshold?)
- ~~Button sensing mechanism (ADC resistor ladder? digital GPIO?)~~ **Likely ADC resistor ladder.** See below.
- Whether the pod tracks any state (e.g. tune mode) or all state lives on the hub
- How the hub discovers pods in its own auto-pairing mode (hub button held)
- Whether manufacturer-specific advertisement data is required
- PIN auth behavior (default `0000`, never enforced — but not tested what happens with wrong PIN)

---

## OEM Pod Works with Di2 Lever Button Block

**Verified 2026-05-28.** Shimano Di2 shift lever buttons (3-wire flat button block, cut from the Di2 "under the hood" controller) work correctly when soldered to the OEM NXS pod's button signal pads and GND. Test ride confirmed both up and down shifting works reliably.

The Di2 button block is a resistor ladder, not simple open/close switches:
- All 3 wires measure ~0Ω between each other (disconnected from any board)
- Pressing a button increases resistance on that wire by a few ohms (2–3.5Ω at 200Ω meter range)
- With a 13kΩ pull-up, buttons produce voltage spikes of ~0.7V (up) and ~1.7V (down)

The OEM pod's row of ~7 SMD passives between the button pads and the nRF52832 chip conditions the signal — likely providing pull-ups and/or voltage divider for ADC reading via P0.02/AIN0.

The SuperMini nRF52840 cannot read these buttons via GPIO edge interrupts (pins sit at ~0V permanently, both ISRs fire on any press due to shared internal resistance). Requires ADC polling approach. See `DI2-LEVER-BUTTONS.md` for full details.
