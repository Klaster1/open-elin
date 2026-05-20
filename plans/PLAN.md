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

## Pod GATT profile — ADVERTISEMENT CONFIRMED, CONTENT UNKNOWN

User observation: **when the hub is asleep and the pod is discoverable, it advertises the same service UUID and characteristics as the hub.**

Confirmed from direct observation (nRF Connect):
- Service: `A5C1C000-CC20-BA91-0C1A-EF3F9E643D79`
- MSG char: `A5C1CC01-CC20-BA91-0C1A-EF3F9E643D79` (write + notify)
- PIN char: `A5C1CC02-CC20-BA91-0C1A-EF3F9E643D79` (write + notify)

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

### Remaining unknowns (to be settled by experiment)

- **Button notify payload format** — we know a notify happens; we don't know the bytes
- **How hub discovers the pod** — hypothesis A: hub scans for the BikeNet service UUID and connects to anything that advertises it; hypothesis B: hub uses manufacturer-specific advertisement data to filter device type; hypothesis C: something else entirely. We don't know yet.
- **Connection parameters** — interval, MTU, etc.
- **Whether manufacturer-specific advertisement data is even required** — the hub might just connect to anything advertising the BikeNet service UUID and figure out device type via GATT after connecting

---

## Plan

- [x] 1. **Hub CLI** — headless Node CLI wrapping the existing demo-node protocol/transport stack. Lets us drive the hub programmatically without the browser UI.
- [ ] 2. **PC fake pod** — standalone Node app that acts as a BLE peripheral with the BikeNet GATT service. Hub connects to it; we log everything the hub writes. Only viable way to observe hub→pod wire format without hardware.
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
| `ble-sniff/FS/data/misc/bluetooth/logs/btsnoop_hci.log` | Phone HCI capture (phone↔hub only) — limited use; does not contain hub↔pod traffic |
| `demo-node/src/node/transport-noble.ts` | Noble BLE transport (reuse for CLI) |
| `demo-node/src/node/app.ts` | BikeNetApp protocol wrapper |
| `demo-node/src/commands.ts` | All AppCommand encoders |
| `demo-node/src/protocol.ts` | Protocol send/receive logic |
