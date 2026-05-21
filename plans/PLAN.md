# Open-Elin Pod Firmware — Implementation Plan

Goal: build a drop-in replacement pod for the NXS BikeNet system running on a nice!nano (nRF52840) board.

---

## Constraints

- No access to original pod firmware binary or source
- SWD pads are exposed on the PCB (V/IO/CLK/G) but **APPROTECT is enabled** — direct dump is blocked
- Fault injection (voltage glitch to bypass APPROTECT) is theoretically possible but non-trivial; treat as last resort
- Must be compatible with NXS hub (eLink) and the BikeNet Android/Flutter apps
- Good battery life mandatory
- **No hub↔pod traffic visibility**: btsnoop is phone HCI log (phone↔hub only); nRF-based sniffer only captures advertisements. Hub↔pod packet content is not observable with current tools. Every claim about what the hub sends to the pod, or how the pod responds, is an unverified hypothesis until empirically demonstrated.
- **btsnoop analysis note**: All occurrences of the BikeNet service UUID in `btsnoop_hci.log` come from the **hub's own advertisement** (MAC `d7:ba:ab:52:a0:e5`). The hub advertises: service UUID `A5C1C000-…` + manufacturer data `ff 98 de 08 01 [hub MAC LE]` (company ID `0xDE98`, payload starts with `08 01`). No pod advertisement packets are present in the capture.

---

## Target hardware — nice!nano v2 (v1 final)

Board: [nice!nano v2](https://nicekeyboards.com/docs/nice-nano/pinout-schematic/) (nRF52840, Pro Micro footprint).
Schematic: `images/nicenano-schematic.png`.

This is both the development board and the v1 final hardware. Housing fit is out of scope.

### Compatibility with pod hardware

| Pod need | nice!nano provision | Notes |
|----------|--------------------|-|
| BLE GATT server (MSG + PIN chars) | nRF52840 BLE 5.0 | Direct; 52840 is strictly better than pod's 52832 |
| 4 buttons (2 tactile + 2 spring) | Enough GPIO on headers | Wire to header pins |
| Blue LED | P0.15 (BLED) onboard + any free GPIO | Built-in |
| Battery voltage ADC | P0.04/AIN2 with R6(806 kΩ)+R7(2 MΩ) divider already fitted | Read, scale, report as `BLE_MSG_BAT_V` |
| SWD debug | J3/J4 pads | Present |
| UART debug | P0.06 TXD / P0.08 RXD | Present |

nRF52840 vs nRF52832: same Zephyr/BLE stack (S140 vs S132), same GATT API, more flash and RAM — no firmware compat issues.

### Power

The nice!nano uses an **AP2112K-3.3 LDO** (VBAT → VDD_NRF 3.3 V). The LDO requires V_in ≥ ~3.6 V minimum. The original pod uses a **CR2032 coin cell (3 V)**, which cannot drive this LDO — coin cell is not an option on this board.

**v1 power: small LiPo + USB-C charging.** The nice!nano has a built-in **LN2054 LiPo charger** fed from the USB-C VBUS pin — plug in USB-C to recharge, no extra hardware needed.

| Cell | Weight | Capacity | Energy | Rechargeable |
|------|--------|----------|--------|--------------|
| CR2032 (original pod) | ~3.0 g | 225 mAh @ 3 V | 0.67 Wh | No |
| 100 mAh LiPo | **~2 g** | 100 mAh @ 3.7 V avg | 0.37 Wh | Yes, via USB-C |
| 150 mAh LiPo | ~3 g | 150 mAh @ 3.7 V avg | 0.56 Wh | Yes, via USB-C |
| 200 mAh LiPo | ~4 g | 200 mAh @ 3.7 V avg | 0.74 Wh | Yes, via USB-C |

A BLE peripheral sleeping between button presses draws ~10–30 µA average with Zephyr sleep modes. At 20 µA:
- **150 mAh LiPo → ~7,500 h ≈ 10 months per charge**, same weight as CR2032
- 100 mAh LiPo → ~5,000 h ≈ 7 months, ~1 g lighter than CR2032

**Recommended: 150 mAh LiPo** — equal weight to the original cell, ~10 months per charge, rechargeable via the existing USB-C port.

**Connection:** Board has B+ and B− through-holes (no JST fitted). Solder bare leads from the cell directly. **Verify polarity with a multimeter before soldering** — red lead should be + but cheap cells vary.

**Cell to buy:** `401535` flat pouch (4×15×35 mm, ~150 mAh, ~3 g). Search AliExpress `"401535 lithium polymer"` or `"150mah 3.7v lipo flat"`. ~$1–3. Ignore whatever connector the listing shows — solder the bare leads.

---

## What we know about the pod

### Buttons

4 physical buttons total:

| # | Function | App ID (`DashboardRemoteButtonId`) | Notes |
|---|----------|------------------------------------|-------|
| 1 | Up | 0x01 `middle` / "Up" | Upshift; fine-tune offset up in tune mode |
| 2 | Down | 0x00 `top` / "Down" | Downshift; fine-tune offset down in tune mode |
| 3 | Fn | 0x02 `bottom` / "Function" | Press: enter fine-tune mode; press again: back to normal shifting |
| 4 | Pairing | — (not a protocol button) | Hidden, no bump, under "N" logo. Hold 6s to enter pairing mode. Handled entirely in firmware, never sent to hub. |

Note: app UI labels ("Down"/"Up") refer to shift direction, which is inverted from physical button position on the pod body.

### Button sensing — unknown mechanism

What's known from APK decompile only (none of this has been run or observed):
- `BLE_CMD_SET_POD_BUTTON_V_LIST` (0x0022): payload constructed with pod MAC + list of values
- `BLE_CMD_GET_POD_BUTTON_V_LIST` (0x0023): payload constructed with pod MAC, no extra parameters
- `BLE_CMD_GET_POD_BUTTON_LAST_V` (0x0024): payload constructed with hub MAC; called during Setup/calibration flow

What any of this means at the pod level, what the hub does with it, and how buttons are physically sensed are all **unknown**. Do not assume anything until verified.

### Battery

Two known mechanisms from the protocol (both APK sources):

1. **`BLE_MSG_BAT_V` (0x4000)** — unsolicited peripheral notification (pod → hub). Payload format is known from `parseBatteryVoltageNotify` in `demo-node/src/commands.ts`:
   - Standard notification frame: `[2 pad bytes] [opcode 0x4000 LE 2 bytes] [target MAC 6 bytes] [voltage payload]`
   - For a **pod** (non-hub) the voltage payload is a **2-byte LE integer (mV)** at bytes 8–9.
   - (Hub sends it differently — reversed bytes → big-endian — but that's the hub's own format, not the pod's.)
2. **`BLE_CMD_GET_LIST` response** — hub polls all paired devices; each 27-byte entry includes a 2-byte LE `batteryVoltage` field (mV). The hub caches the value last reported via `BLE_MSG_BAT_V`.

What's **unknown**: what triggers the pod to send `BLE_MSG_BAT_V` (on connection, periodic timer, voltage threshold change, or on request).

### BLE role

The pod is a **BLE peripheral** (advertiser). Source: direct observation — pod was visibly advertising the BikeNet service UUID while hub was asleep (observable via nRF Connect). A device that advertises is by definition a peripheral; the hub is the central.

The app never directly connects to pods.

### Pairing procedure (from OG Bikeworks docs)

1. **Hub**: hold function button 10 seconds → factory reset + enters auto-pairing mode for 1 minute
2. **Pod**: hold hidden reset button 6 seconds → pod LED blinks → pod auto-connects to hub
3. **Verify**: press any pod button → hub LED blinks

Implication: during pairing the hub likely scans for pods and initiates the connection — consistent with hub = central, pod = peripheral. But "pod auto-connects to hub" in the docs is colloquial; treat this as an inference. Verify empirically in Exp 1 (advertise from nice!nano, trigger hub pairing mode, see if hub connects).

---

## Pod GATT profile — ADVERTISEMENT AND GATT CONFIRMED

### Advertisement (empirically captured via noble scan, May 2026)

| Field | Value |
| ----- | ----- |
| **Local name** | `NXS MTB Pod` |
| **Service UUIDs in adv** | *(none — not included in primary advertisement)* |
| **Manufacturer data** | *(none)* |
| **TX power level** | 0 dBm |
| **Service data** | *(none)* |

The BikeNet service UUID does **not** appear in the pod's advertisement packet. The hub must be discovering pods by local name (`NXS MTB Pod`), not by service UUID filtering. Confirmed by the failed experiment where a fake pod advertising service UUID but with name `open-elin-pod` was not connected to by the hub.

### GATT services (confirmed via nRF Connect):
- Service: `A5C1C000-CC20-BA91-0C1A-EF3F9E643D79`
- MSG char: `A5C1CC01-CC20-BA91-0C1A-EF3F9E643D79` (write + notify)
- PIN char: `A5C1CC02-CC20-BA91-0C1A-EF3F9E643D79` (write + notify)

Direct GATT enumeration from PC (noble/WinRT) returned `Unreachable` — the pod likely drops connections from unrecognised MAC addresses, or requires prior bonding.

**What the hub actually sends to the pod over these characteristics, and what the pod sends back, is entirely unknown.** The guess that the hub reuses the same encoding as the app uses for hub commands is a hypothesis — not observed. Do not design firmware around it until verified empirically.

### App→hub commands that reference pod MAC (unknown if hub relays to pod)

Source: APK decompile only. The app sends these to the **hub**. Whether the hub relays any of them to the pod over BLE, or handles them entirely itself, is **unknown** — we have no hub↔pod traffic capture.

| Command | Opcode | App-side notes |
| ------- | ------ | -------------- |
| `BLE_CMD_SET_NAME` | 0x0009 | App sends with device MAC; hub may store locally |
| `BLE_CMD_SET_POD_BUTTON_V_LIST` | 0x0022 | Payload includes pod MAC + value list |
| `BLE_CMD_GET_POD_BUTTON_V_LIST` | 0x0023 | Payload includes pod MAC |
| `BLE_CMD_GET_POD_BUTTON_LAST_V` | 0x0024 | Payload includes hub MAC; called during calibration |

Do not implement any of these on the pod until we observe hub→pod traffic and confirm which (if any) are forwarded.

PIN auth: **not required** on the pod in practice (default PIN is `0000`, never enforced). Ignore for now.

### Button notifications (pod → hub)

Format unknown. Open questions:
- Does the pod send button IDs, raw ADC values, or something else?
- Does the pod track any state at all (e.g. tune mode), or does all state live on the hub?
- Is it a notify on MSG char, or a different mechanism?

**Do not assume — verify via experiment.**

### Hub → App notifications (empirically confirmed via `hub monitor`, May 2026)

All notifications arrive on the MSG characteristic and are parsed into the same frame:
```
[00 00] [opcode 2 bytes LE] [target MAC 6 bytes LE] [payload...]
```

| Event | Opcode | Payload | Notes |
|-------|--------|---------|-------|
| `battery-voltage` | `0x4000` | `[mV 2 bytes LE]` (pod) / `[mV bytes reversed, i.e. BE]` (hub) | Sent when pod/hub reports voltage |
| `button-action` | `0x4001` | `[buttonId 1 byte] [actionFlag 1 byte]` — actionFlag `0x00` = Press, `0x01` = Release | targetMac = **pod MAC** — hub forwards pod button events to app |
| `shift-complete` | `0x4003` | 3 bytes observed: `[0x1F, 0x00, 0x01]` (gear/position data) | targetMac = **hub MAC** — fires when shift finishes, incl. pod-button-triggered shifts |

#### Raw `hub monitor` output — real session (2026-05-21T06:53 UTC)

Scenario: pod connected, single button press (A-1 = Shift Down), shift completes.

```jsonl
{"event":"battery-voltage","status":"success","code":16384,"targetMac":"D5:89:B2:13:FA:04","batteryVoltage":2871,"isHub":false,"rawHex":"370B","rawBytes":[55,11],"ts":"2026-05-21T06:53:08.597Z"}
{"event":"button-action","status":"success","code":16385,"targetMac":"D5:89:B2:13:FA:04","buttonId":0,"buttonHex":"00","buttonLabel":"-","actionFlag":1,"actionLabel":"Release","rawHex":"0001","rawBytes":[0,1],"ts":"2026-05-21T06:53:08.717Z"}
{"event":"button-action","status":"success","code":16385,"targetMac":"D5:89:B2:13:FA:04","buttonId":1,"buttonHex":"01","buttonLabel":"A-1","actionFlag":0,"actionLabel":"Press","rawHex":"0100","rawBytes":[1,0],"ts":"2026-05-21T06:53:09.316Z"}
{"event":"button-action","status":"success","code":16385,"targetMac":"D5:89:B2:13:FA:04","buttonId":1,"buttonHex":"01","buttonLabel":"A-1","actionFlag":1,"actionLabel":"Release","rawHex":"0101","rawBytes":[1,1],"ts":"2026-05-21T06:53:09.497Z"}
{"event":"shift-complete","status":"success","code":16387,"targetMac":"D7:BA:AB:52:A0:E5","payloadValue":65567,"rawHex":"1F0001","rawBytes":[31,0,1],"ts":"2026-05-21T06:53:10.096Z"}
```

#### Observations from this trace

1. **Battery on connect**: pod emits battery voltage (`2871 mV`, rawHex `370B` = `0x0B37` LE) immediately when session starts.
2. **Spurious release of button 0x00 on connect** (ts +0.12 s after battery): pod sends a Release of buttonId `0x00` (`-`) with no preceding Press. Likely a power-on / reconnect reset signal from the pod firmware.
3. **A-1 press/release** (ts +0.72 s / +0.9 s): user presses button A-1 (buttonId `0x01`). Hub forwards both Press (`rawHex 0100`) and Release (`rawHex 0101`) to app.
4. **Shift-complete** (ts +1.5 s after battery, +0.6 s after release): hub reports shift finished. targetMac is **hub MAC** `D7:BA:AB:52:A0:E5`. Payload `1F 00 01` = 3 bytes LE value `0x01001F` = 65567. Byte breakdown unclear — `0x1F`=31 may be raw position, `0x01` may be gear index.

#### Pod → Hub notification format (inferred)

The hub forwards pod button-action events to the app verbatim with `targetMac = pod MAC`. This strongly implies the pod itself sends the same frame format including its own MAC:

```
[00 00] [01 40] [pod MAC 6 bytes LE] [buttonId 1 byte] [actionFlag 1 byte]
```

Similarly for battery:
```
[00 00] [00 40] [pod MAC 6 bytes LE] [mV 2 bytes LE]
```

This is the most important input for firmware implementation: pod must write these notification frames to the MSG characteristic.

When a pod button is pressed → hub matches button map → hub shifts → hub emits `shift-complete` (0x4003) to app.

### Remaining unknowns (to be settled by experiment)

- **Button notify payload format** — ✅ **RESOLVED** (see trace above): `[buttonId] [actionFlag]` with the full frame `[00 00] [01 40] [pod MAC 6] [buttonId] [actionFlag]`
- **Spurious button-0 Release on connect** — pod always emits a Release of buttonId 0x00 at connection time; unknown if this is intentional (e.g. "I'm alive" signal) or a firmware quirk; firmware should replicate it to stay compatible
- **Shift-complete payload meaning** — `1F 00 01` observed after one shift; byte meanings unclear (raw encoder position? gear index?); need more samples at different gears
- **How hub discovers the pod** — hypothesis A: hub scans for the BikeNet service UUID and connects to anything that advertises it; hypothesis B: hub uses manufacturer-specific advertisement data to filter device type; hypothesis C: something else entirely. We don't know yet.
- **Connection parameters** — interval, MTU, etc.
- **Whether manufacturer-specific advertisement data is even required** — the hub might just connect to anything advertising the BikeNet service UUID and figure out device type via GATT after connecting

---

## Empirical findings — CLI probing of real pod (May 2026)

### Architecture confirmed

- **Pod** (`d5:89:b2:13:fa:04`, NXS MTB Pod) = handlebar **button unit** — has physical buttons, NO derailleur motor
- **Hub** (`d7:ba:ab:52:a0:e5`, NXS eLink hub) = central unit — connected to derailleur mechanism, communicates with pod via BLE (hub = central, pod = peripheral), and with app/CLI via BLE (hub = peripheral)

### Software pairing confirmed

`hub set-bikenet` → `hub add-device <pod-mac>` works. Hub connects to pod and shows `● connected` in hub list. Physical button press on hub was **not** required.

### Pod connection procedure — CLI only (no app required)

Full sequence to connect a pod and get buttons working from scratch, empirically verified 2026-05-21:

**One-time setup (new hub, or after factory reset only):**
```
node src/cli.ts hub set-bikenet --address <hub-mac>
```
> ⚠️ `set-bikenet` resets all hub state including any existing pod bonds. **Do not run this if the pod is already paired** — skip straight to step 2.

**Step 1 — Add pod to hub:**
```
node src/cli.ts hub add-device --address <hub-mac> --timeout 15000 <pod-mac>
```
The hub scans for the pod by BLE local name `NXS MTB Pod` (not by service UUID) and bonds to it. Hub sends notification `0x8006` (new bond) or `0x8007` (reconnect if already bonded). Returns error `0x8003` (INVALID_STATE) if the pod is already in the hub's list — this is benign, proceed to step 3.

Verify with:
```
node src/cli.ts hub list --address <hub-mac>
```
Pod should appear with `●` (connected).

**Step 2 — Write button map:**
```
node src/cli.ts hub write-button-map --address <hub-mac> --use-captured
```
This writes the 7 button-map entries that map pod button codes to shift/tune actions. **Without this the hub silently ignores all pod button presses.** The `--use-captured` flag uses the entries read from the hub after original app pairing (pod `04FA13B289D5` ↔ hub `E5A052ABBAD7`); re-capture with `hub read-button-map` if using different hardware.

**Verify:**
Press a pod button — the derailleur should physically move. That's it.

### Real pod state (read 2026-05-21)

| Command | Result |
|---------|--------|
| `hub get-rear-cog` | 12-speed, positions 1–23 (odd), teeth 11–32 |
| `hub get-motor-params` | stallDetection:2300, pwmFreq:50000, accel:30, overshiftDist:0.4, overshiftDelay:500, multishiftDelay:200 |
| `hub get-position` | absolutePosition:3, gearPosition:2 (after one shift-down) |
| `hub read-button-map` | **EMPTY** — mapByteLength:0, entryCount:0 |
| `hub read-button-table` | **EMPTY** — entries:[] |

### Why pod buttons don't trigger shifts — CONFIRMED

**Before proper app pairing**: button map empty (`entryCount:0`), button table empty (`entries:[]`). Pod button presses silently ignored.

**After proper app pairing** (user held hub button, paired via app UI): button map has 7 entries (`mapByteLength:112`), buttons work.

### Button map (read after proper pairing, 2026-05-21)

Pod `04FA13B289D5` ↔ hub `E5A052ABBAD7`. 7 entries, all action=Press:

| index | button1 code | button1 label | function code | function |
|-------|-------------|---------------|---------------|----------|
| 0 | `00` | `-` | `0A` | Shift Up |
| 1 | `06` | B | `0B` | Shift Down |
| 2 | `0C` | C | `11` | Tune Mode |
| 3 | `0D` | C-1 | `0A` | Shift Up |
| 4 | `01` | A-1 | `0B` | Shift Down |
| 5 | `12` | D | `0B` | Shift Down |
| 6 | `02` | A-2 | `11` | Tune Mode |

Button codes the pod emits: `0x00`, `0x01`, `0x02`, `0x06`, `0x0C`, `0x0D`, `0x12`. Labels (A-1, A-2, B, C, C-1, D) correspond to the pod's wired PORT_A/B/C/D inputs (from `Constants.java`). Two codes per port (e.g. A-1=`0x01`, A-2=`0x02`) likely = two buttons wired to that port connector.

**What the firmware must do**: when a physical button is pressed, send a BLE notification on the MSG characteristic containing the button code. The hub matches it against the map and triggers the action. The exact notification payload format is still unknown — next step is to decode it from `PROTOCOL_NEW.md` or by capturing a button press via `hub monitor`.

---

## Plan


- [x] 1. **Hub CLI** — headless Node CLI wrapping the existing demo-node protocol/transport stack. Lets us drive the hub programmatically without the browser UI.
- [x] 2. **PC fake pod** — standalone Node app that acts as a BLE peripheral with the BikeNet GATT service. Implemented and running on Mac via LaunchAgent. Hub→pod wire format still unknown (hub didn't connect to fake pod — macOS CoreBluetooth uses rotating random private addresses for peripheral mode; hub can't reconnect to a rotating address). Deprioritised in favour of direct CLI probing of the real pod.
- [ ] 3. **nice!nano USB-only prototype** — once protocol is known, port to Zephyr on nice!nano. No buttons/LEDs/battery yet; events injected via USB serial. Proves the nRF52840 + Zephyr stack works end-to-end with the real hub.
- [ ] 4. **Breadboard** — wire buttons and LiPo to nice!nano. Verify full hardware path.
- [ ] 5. **Optimise** — tune BLE connection interval and sleep modes; verify battery life on LiPo.

**Tools available:** webcam pointed at the bike for visual confirmation of hub LED states during steps 2–4. Access: open a browser tab to a local camera stream (e.g. OBS virtual cam → browser source, or any IP camera URL), or open any page that calls `getUserMedia` and grant camera permission once — tab stays open, agent takes screenshots on demand with no further user interaction required.

---

## Reference files in this repo

| Path | What's in it |
| ---- | ------------ |
| `PCB-HARDWARE-MAP.md` | Pod PCB traces, pin assignments, component IDs (pod hardware only) |
| `images/nicenano-schematic.png` | nice!nano v2 schematic — dev board used for firmware development |
| `apk-extracted-project/PROTOCOL.md` | Full hub BLE protocol (old app) |
| `apk-extracted-project-bikenet-new/PROTOCOL_NEW.md` | Updated protocol (Flutter app), button map details |

> **Protocol reliability note**: Both `PROTOCOL.md` (old Android app) and `PROTOCOL_NEW.md` (new Flutter app) describe the **same hub firmware**. For features exercised by the old app (add-device, write-button-map, pod button notifications), `PROTOCOL.md` is the authoritative source — it was validated against real observed behaviour. For features the new app does not use (e.g. the new 16-byte button map entry format, `BLE_CMD_SET_FRONT_CONFIG`, etc.), `PROTOCOL_NEW.md` contains decompiler guesses that have never been exercised and may be wrong. When the two docs disagree on something the old app uses, trust `PROTOCOL.md`.
| `ble-sniff/FS/data/misc/bluetooth/logs/btsnoop_hci.log` | Phone HCI capture (phone↔hub only) — limited use; does not contain hub↔pod traffic |
| `demo-node/src/node/transport-noble.ts` | Noble BLE transport (reuse for CLI) |
| `demo-node/src/node/app.ts` | BikeNetApp protocol wrapper |
| `demo-node/src/commands.ts` | All AppCommand encoders |
| `demo-node/src/protocol.ts` | Protocol send/receive logic |
