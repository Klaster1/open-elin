# NXS (BikeNet) BLE Protocol — New App (Flutter/Dart, bikenet2)

This document covers protocol findings from the **new** BikeNet Flutter/Dart APK (`bikenet2`), decompiled with blutter from `libapp.so` (Dart 3.11.0, ARM64). It supersedes the old Android protocol where commands and codes differ.

Sources: `decompiled-dart/asm/bikenet_sdk/src/` and `decompiled-dart/pp.txt`.

---

## Service & Characteristic UUIDs

**Unchanged from old protocol.**

- Service: `a5c1c000-cc20-ba91-0c1a-ef3f9e643d79`
- MSG characteristic (write/notify): `a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79`
- PIN characteristic (write/notify): `a5c1cc02-cc20-ba91-0c1a-ef3f9e643d79`
- CCCD: `00002902-0000-1000-8000-00805f9b34fb`

---

## Auth / PIN unlock

Same as old protocol. Write PIN to the PIN characteristic; wait for `0x01` notify before issuing commands.

- Default PIN: `1111` → encoded `01 01 01 01`
- If `BLE_STATUS_FORBIDDEN` is received, send PIN and retry.

---

## Key changes vs. old protocol

1. **New commands added at 0x001B–0x0028** — inserted between existing motor/position commands and pod-button commands. Existing commands 0x0000–0x001A and 0x001D–0x001F are **unchanged in opcode**.
2. **START_DFU (0x0021)** and five other new commands (0x0025–0x0028). Note: START_DFU is defined in the protocol but **not yet implemented** in the current app.
3. **Protocol MAC** — the SDK now distinguishes a "protocol MAC" from the BLE MAC address. In most commands the target MAC is still the hub's BLE MAC; the "protocol MAC" appears in error messages and may differ after firmware pairing procedures.
4. **New peripheral notifications** — `BLE_MSG_ELINK_FUNCTION` (0x2000) and `BLE_MSG_SHIFT_FRONT` (0x2001) added for seatpost/eLink and front derailleur events.
5. **Structured `BLE_MSG_SHIFT_COMPLETE` payload** — now 3 bytes (position + gear) instead of raw hex.
6. **Front derailleur support** — `BLE_CMD_SET/GET_FRONT_CONFIG` (0x001B/0x001C), `SET/GET_FRONT_COG_INFO` (0x001E/0x0020).

### Pod-button command renames (opcodes unchanged)

| Opcode | Old name                        | New name                      |
| ------ | ------------------------------- | ----------------------------- |
| 0x0022 | BLE_CMD_SET_TUNING_BUTTON_LEVEL | BLE_CMD_SET_POD_BUTTON_V_LIST |
| 0x0023 | BLE_CMD_READ_TUNING_BUTTON      | BLE_CMD_GET_POD_BUTTON_V_LIST |
| 0x0024 | BLE_CMD_GET_LAST_V              | BLE_CMD_GET_POD_BUTTON_LAST_V |

Commands 0x0000–0x001A, 0x001D, and 0x001F are **unchanged**.

---

## Encoding rules / framing

Same as old protocol:

- Request payload: `reverseCommand(opcode)` + `reversedMac` [+ parameters]
- `reverseCommand("0x001C")` → swap 2-byte halves of the 4-digit hex → `1C00`
- `reversedMac` → MAC bytes reversed and colons removed → `AA:BB:CC:DD:EE:FF` → `FFEEDDCCBBAA`
- Response header: 2-byte status code (LE) + 6-byte target MAC + payload bytes

SDK helpers (Dart, from `codec.dart`):

- `macBeToBytesLe(mac)` — converts MAC string to reversed bytes (equivalent to `reverseMacAddress`)
- `writeU16LE(builder, value)` — append u16 little-endian to builder
- `readU16LE(buf)` — read u16 LE from codec buffer
- `readU8(buf)` — read u8 from codec buffer
- `u16x10FromMm(mm)` — convert mm double to u16 × 10 integer
- `_u8x10FromMm(mm)` — convert mm double to u8 × 10 integer (clamped 0–255)

---

## Complete command table

| Opcode | Name                          | Changed?            |
| ------ | ----------------------------- | ------------------- |
| 0x0000 | BLE_CMD_GET_LIST              |                     |
| 0x0001 | BLE_CMD_ADD_DEVICE            |                     |
| 0x0002 | BLE_CMD_REMOVE_DEVICE         |                     |
| 0x0003 | BLE_CMD_SET_PIN               |                     |
| 0x0004 | BLE_CMD_BLINK_LED             |                     |
| 0x0005 | BLE_CMD_SET_BIKENET           |                     |
| 0x0006 | BLE_CMD_RESET_BIKENET         |                     |
| 0x0007 | BLE_CMD_DISCONNECT_DEVICE     |                     |
| 0x0008 | BLE_CMD_RECONNECT_DEVICE      |                     |
| 0x0009 | BLE_CMD_SET_NAME              |                     |
| 0x000B | BLE_CMD_CALIBRATE             |                     |
| 0x000C | BLE_CMD_SET_DEV_CONFIG        |                     |
| 0x000D | BLE_CMD_INCREMENT_MOVE        |                     |
| 0x000E | BLE_CMD_ABSOLUTE_MOVE         |                     |
| 0x000F | BLE_CMD_UPDATE_POSITION       |                     |
| 0x0010 | BLE_CMD_SHIFT_UP              |                     |
| 0x0011 | BLE_CMD_SHIFT_DOWN            |                     |
| 0x0012 | BLE_CMD_MOVE_TO_COG           |                     |
| 0x0013 | BLE_CMD_GET_POSITION          |                     |
| 0x0014 | BLE_CMD_WRITE_BUTTON_MAP      |                     |
| 0x0015 | BLE_CMD_READ_BUTTON_MAP       |                     |
| 0x0016 | BLE_CMD_SET_MOTOR_PARAMS      |                     |
| 0x0017 | BLE_CMD_GET_MOTOR_PARAMS      |                     |
| 0x0018 | BLE_CMD_GET_SKIP_TABLE        |                     |
| 0x0019 | BLE_CMD_MOTOR_HOME            |                     |
| 0x001A | BLE_CMD_SET_SKIP_TABLE        |                     |
| 0x001B | BLE_CMD_SET_FRONT_CONFIG      | **NEW**             |
| 0x001C | BLE_CMD_GET_FRONT_CONFIG      | **NEW**             |
| 0x001D | BLE_CMD_SET_REAR_COG_INFO     |                     |
| 0x001E | BLE_CMD_SET_FRONT_COG_INFO    | **NEW**             |
| 0x001F | BLE_CMD_GET_REAR_COG_INFO     |                     |
| 0x0020 | BLE_CMD_GET_FRONT_COG_INFO    | **NEW**             |
| 0x0021 | BLE_CMD_START_DFU             | **NEW** (not impl.) |
| 0x0022 | BLE_CMD_SET_POD_BUTTON_V_LIST | renamed             |
| 0x0023 | BLE_CMD_GET_POD_BUTTON_V_LIST | renamed             |
| 0x0024 | BLE_CMD_GET_POD_BUTTON_LAST_V | renamed             |
| 0x0025 | BLE_CMD_GET_FW_VER            | **NEW**             |
| 0x0026 | BLE_CMD_GET_SEATPOST_COUNT    | **NEW** (not impl.) |
| 0x0027 | BLE_CMD_PWR_DWN               | **NEW** (not impl.) |
| 0x0028 | BLE_CMD_TUNE_MODE             | **NEW** (not impl.) |

---

## Command reference

Most commands 0x0000–0x001A retain the same encoding as documented in `PROTOCOL.md`. Commands with updated or clarified details are documented below, followed by all new commands.

---

### BLE_CMD_WRITE_BUTTON_MAP (0x0014) — updated entry format

**Purpose**: Write the full button mapping table to the hub. Sent to the **hub** (not to pods). All entries are written in one payload.

**Request format**: `reverseCommand(0x0014)` + reversed hub MAC + map payload.

Map payload: up to **64 entries**, each exactly **16 bytes**. Total max payload = 1024 bytes. Sending a payload whose length is not a multiple of 16 throws `ProtocolMismatchException`.

**Entry layout** (from `encodeDashboardButtonMap` / `decodeDashboardButtonMap` in `dashboard_button_mapping.dart`):

| Offset | Size | Field          | Notes                                                                      |
| ------ | ---- | -------------- | -------------------------------------------------------------------------- |
| 0      | 6    | `targetMac`    | Target device MAC, bytes reversed (LE)                                     |
| 6      | 6    | `sourceMac`    | Source pod MAC, bytes reversed (LE)                                        |
| 12     | 1    | `buttonId[0]`  | First button in chord; `DashboardRemoteButtonId`                           |
| 13     | 1    | `buttonId[1]`  | Second button in chord; `DashboardRemoteButtonId` or 0xFF if single-button |
| 14     | 1    | `buttonAction` | Action type (press/release/etc.); values 0–3                               |
| 15     | 1    | `function`     | Function code; `DashboardButtonFunction.off_14`                            |

`targetMac` is the device that receives the action (hub/rear derailleur, front derailleur, or seatpost). `sourceMac` is the pod that originates the button event.

**DashboardRemoteButtonId** — physical button on a pod:

| Value | Name     | UI label   |
| ----- | -------- | ---------- |
| 0x00  | `top`    | "Down"     |
| 0x01  | `middle` | "Up"       |
| 0x02  | `bottom` | "Function" |

**DashboardButtonFunction** — assignable functions (`off_14` = wire value):

| Value | Name             | UI label          |
| ----- | ---------------- | ----------------- |
| 0x0A  | `shiftUp`        | "Shift Up"        |
| 0x0B  | `shiftDown`      | "Shift Down"      |
| 0x0C  | `toggle`         | "Toggle"          |
| 0x0D  | `seatpostLock`   | "Seatpost Lock"   |
| 0x0E  | `seatpostUnlock` | "Seatpost Unlock" |
| 0x0F  | `autoUp`         | "Auto Up"         |
| 0x10  | `autoDown`       | "Auto Down"       |
| 0x11  | `tuneMode`       | "Tune Mode"       |

**DashboardButtonTargetKind** — what type of device receives the action:

| Value | Name              | UI label           |
| ----- | ----------------- | ------------------ |
| 0x00  | `rearDerailleur`  | "Rear derailleur"  |
| 0x01  | `frontDerailleur` | "Front derailleur" |
| 0x02  | `seatpost`        | "Seatpost"         |
| 0x03  | `unknown`         | "Saved target"     |

**Example** — assign pod `11:22:33:44:55:66` top button ("Down") → shift down on hub `AA:BB:CC:DD:EE:FF`:

- `targetMac` = `FF EE DD CC BB AA`
- `sourceMac` = `66 55 44 33 22 11`
- `buttonId[0]` = `0x00` (top / "Down")
- `buttonId[1]` = `0xFF` (single-button, no chord)
- `buttonAction` = `0x00` (press)
- `function` = `0x0B` (shiftDown)
- Entry bytes: `FF EE DD CC BB AA  66 55 44 33 22 11  00 FF 00 0B`
- Full request: `1400` + `FFEEDDCCBBAA` + entry bytes

**Notes**:

- Function codes `0x0A`–`0x0B` (shiftUp/shiftDown) are the same values used in the old protocol.
- The `targetMac` field replaces the old "hub MAC" field — in the new protocol it may point to a front derailleur or seatpost instead.
- `SEND_MAP` (`01`) prefix byte present in old protocol is **gone** in the new format; entries follow the MAC prefix directly.

---

### BLE_CMD_READ_BUTTON_MAP (0x0015) — updated decode

**Purpose**: Read the current button mapping table stored on the hub. Sent to the **hub**.

**Request format**: `reverseCommand(0x0015)` + reversed hub MAC. No parameters.

**Response**: standard header (2-byte status LE + 6-byte MAC) + map payload.

Map payload is a flat byte array of N × 16-byte entries. Divide payload length by 16 to get the entry count. An empty payload (length 0) means no mappings are stored.

**Important**: the new app does **not** reverse the entire response payload before parsing (unlike the old Android app which reversed all bytes then hex-encoded). Parse the raw response bytes directly as described below.

**Response entry layout** (from `decodeDashboardButtonMap` in `dashboard_button_mapping.dart`):

| Offset | Size | Field          | Decode                                                                |
| ------ | ---- | -------------- | --------------------------------------------------------------------- |
| 0      | 6    | `targetMac`    | Call `bytesLeToMacBe(buf, offset)` → MAC string `"AA:BB:CC:DD:EE:FF"` |
| 6      | 6    | `sourceMac`    | Call `bytesLeToMacBe(buf, offset+6)` → MAC string                     |
| 12     | 1    | `buttonId[0]`  | u8 — first button; see `DashboardRemoteButtonId` table                |
| 13     | 1    | `buttonId[1]`  | u8 — second button in chord, or `0xFF` if single-button press         |
| 14     | 1    | `buttonAction` | u8 — action type (0 = press, 1 = release, etc.)                       |
| 15     | 1    | `function`     | u8 — function code; see `DashboardButtonFunction` table               |

`bytesLeToMacBe(buf, offset)` reads 6 bytes at `offset` and reverses them to produce standard colon-separated MAC notation (e.g., bytes `FF EE DD CC BB AA` → `"AA:BB:CC:DD:EE:FF"`).

**Decode algorithm**:

```
entries = []
if (payload.length % 16 != 0) throw ProtocolMismatchException
for i in range(0, payload.length, 16):
    targetMac   = bytesLeToMacBe(payload, i + 0)   // 6 bytes
    sourceMac   = bytesLeToMacBe(payload, i + 6)   // 6 bytes
    buttonId0   = payload[i + 12]                   // u8
    buttonId1   = payload[i + 13]                   // u8 (0xFF = single button)
    buttonAction= payload[i + 14]                   // u8
    function    = payload[i + 15]                   // u8
    entries.append({targetMac, sourceMac, buttonId0, buttonId1, buttonAction, function})
```

**DashboardRemoteButtonId** — physical button on a pod:

| Value | Name     | UI label   |
| ----- | -------- | ---------- |
| 0x00  | `top`    | "Down"     |
| 0x01  | `middle` | "Up"       |
| 0x02  | `bottom` | "Function" |

**DashboardButtonFunction** — function code values:

| Value | Name             | UI label          |
| ----- | ---------------- | ----------------- |
| 0x0A  | `shiftUp`        | "Shift Up"        |
| 0x0B  | `shiftDown`      | "Shift Down"      |
| 0x0C  | `toggle`         | "Toggle"          |
| 0x0D  | `seatpostLock`   | "Seatpost Lock"   |
| 0x0E  | `seatpostUnlock` | "Seatpost Unlock" |
| 0x0F  | `autoUp`         | "Auto Up"         |
| 0x10  | `autoDown`       | "Auto Down"       |
| 0x11  | `tuneMode`       | "Tune Mode"       |

**DashboardButtonTargetKind** — classification of the `targetMac` device:

| Value | Name              | UI label           |
| ----- | ----------------- | ------------------ |
| 0x00  | `rearDerailleur`  | "Rear derailleur"  |
| 0x01  | `frontDerailleur` | "Front derailleur" |
| 0x02  | `seatpost`        | "Seatpost"         |
| 0x03  | `unknown`         | "Saved target"     |

The app resolves `targetMac` → `DashboardButtonTargetKind` by matching it against the list of paired devices by type.

**Example** — response payload with two entries:

Hub MAC `AA:BB:CC:DD:EE:FF`, pod MAC `11:22:33:44:55:66`.

```
Response payload (32 bytes):
FF EE DD CC BB AA  66 55 44 33 22 11  00 FF 00 0A   <- entry 0
FF EE DD CC BB AA  66 55 44 33 22 11  01 FF 00 0B   <- entry 1
```

Decoded:

| #   | targetMac         | sourceMac         | btn0               | btn1          | action       | function         |
| --- | ----------------- | ----------------- | ------------------ | ------------- | ------------ | ---------------- |
| 0   | AA:BB:CC:DD:EE:FF | 11:22:33:44:55:66 | 0x00 (top/"Down")  | 0xFF (single) | 0x00 (press) | 0x0A (shiftUp)   |
| 1   | AA:BB:CC:DD:EE:FF | 11:22:33:44:55:66 | 0x01 (middle/"Up") | 0xFF (single) | 0x00 (press) | 0x0B (shiftDown) |

**Differences from old protocol**:

- Old app reversed the entire payload before interpreting it, then hex-encoded it. New app parses bytes directly.
- `targetMac` may now refer to a front derailleur or seatpost — not necessarily the hub.
- Entries up to 64 max (old limit unknown).

---

### BLE_CMD_SET_REAR_COG_INFO (0x001D) — unchanged

**Opcode unchanged** from old protocol. Encoding is identical.

**Request format**: `reverseCommand(0x001D)` + reversed hub MAC + parameters.

Parameters: repeating 3-byte chunks per gear.

- Bytes 0–1: cable position in tenths of mm, u16 LE (`cablePos * 10`)
- Byte 2: cog tooth count, u8

**Example (same as old, opcode updated)**:

- Payload hex: `1C00FFEEDDCCBBAA` + `0C000C1E000F` (2 gears, 12-teeth and 15-teeth).

---

### BLE_CMD_GET_REAR_COG_INFO (0x001F) — unchanged

**Opcode unchanged** from old protocol. Request and response format unchanged.

**Request format**: `reverseCommand(0x001F)` + reversed hub MAC. No parameters.

**Response**: repeating 3-byte chunks per gear (same as SET minus the reversal step old doc described — parse directly as LE chunks).

---

### BLE_CMD_SET_POD_BUTTON_V_LIST (0x0022) — renamed

**Renamed** from `BLE_CMD_SET_TUNING_BUTTON_LEVEL`. Opcode **unchanged** at 0x0022. Encoding identical.

**Request format**: `reverseCommand(0x0022)` + reversed pod MAC + parameters.

Parameters: repeating 2-byte LE levels, one per tuning button.

**Example**:

- Levels `[300, 450]` → `2C 01 C2 01`.
- Payload: `2200` + `665544332211` + `2C01C201`.

---

### BLE_CMD_GET_POD_BUTTON_V_LIST (0x0023) — renamed

**Renamed** from `BLE_CMD_READ_TUNING_BUTTON`. Opcode **unchanged** at 0x0023. Encoding identical.

**Request format**: `reverseCommand(0x0023)` + reversed pod MAC. No additional parameters.

**Response**: repeating 2-byte LE values, one per tuning button.

---

### BLE_CMD_GET_POD_BUTTON_LAST_V (0x0024) — renamed

**Renamed** from `BLE_CMD_GET_LAST_V`. Opcode **unchanged** at 0x0024. Encoding identical.

**Request format**: `reverseCommand(0x0024)` + reversed hub MAC. No parameters.

Response: same format as old `BLE_CMD_GET_LAST_V`.

---

### BLE_CMD_SET_FRONT_CONFIG (0x001B) — NEW

**Purpose**: Write front derailleur trim and position parameters.

**Request format**: `reverseCommand(0x001B)` + reversed hub MAC + 11-byte payload.

**Payload byte layout** (from `encodeDashboardFrontConfig` in `dashboard_front_config.dart`):

| Offset | Size | Type   | Field              | Unit               |
| ------ | ---- | ------ | ------------------ | ------------------ |
| 0      | 2    | u16 LE | `lowPositionMm`    | mm × 10            |
| 2      | 2    | u16 LE | `highPositionMm`   | mm × 10            |
| 4      | 1    | u8     | `followCompMm`     | mm × 10            |
| 5      | 1    | u8     | `chainringCount`   | integer, range 2–4 |
| 6      | 1    | u8     | `minTrimMm`        | mm × 10            |
| 7      | 1    | u8     | `compStepMm`       | mm × 10            |
| 8      | 1    | u8     | `gearStepMm`       | mm × 10            |
| 9      | 2    | u16 LE | `lowestPositionMm` | mm × 10            |

Field semantics (from `decodeDashboardFrontConfig` debug labels):

- `lowPositionMm` — "front low position": the lowest cable travel position in the front derailleur range.
- `highPositionMm` — "front high position": the highest cable travel position.
- `followCompMm` — "front follow compensation": compensation distance for chain-following movement.
- `chainringCount` — "front minimum change": number of chainrings (2–4); note decode reads this as u8/10, so the firmware may treat this as a scaled byte.
- `minTrimMm` — "front minimum trim": minimum trim adjustment.
- `compStepMm` — "front compensation step": per-shift compensation increment.
- `gearStepMm` — "front gear step": cable stroke per gear step (calculated as `(highPos – lowPos) / (chainringCount – 1)` by the app).
- `lowestPositionMm` — "front lowest position": absolute lowest allowed cable position.

**Default values** (used when no config is stored):

- `followCompMm`: 2.0 mm
- `minTrimMm`: 0.3 mm
- `compStepMm`: 0.2 mm

**Encoding helpers**:

```
u16x10(mm)  = round(mm * 10) as u16
u8x10(mm)   = clamp(round(mm * 10), 0, 255) as u8
```

**Example** (3 chainrings, low=0.0 mm, high=8.0 mm, followComp=2.0, minTrim=0.3, compStep=0.2):

- `lowPositionMm` = 0.0 → `0000`
- `highPositionMm` = 8.0 → `5000` (80 decimal = 0x0050, LE → `50 00`)
- `followCompMm` = 2.0 → `14` (20)
- `chainringCount` = 3 → `03`
- `minTrimMm` = 0.3 → `03`
- `compStepMm` = 0.2 → `02`
- `gearStepMm` = (8.0 – 0.0) / (3 – 1) = 4.0 → `28` (40)
- `lowestPositionMm` = 0.0 → `0000`
- Full payload: `1B00FFEEDDCCBBAA` + `00005000140303022800 00`

---

### BLE_CMD_GET_FRONT_CONFIG (0x001C) — NEW

**Purpose**: Read front derailleur config.

**Request format**: `reverseCommand(0x001C)` + reversed hub MAC. No parameters.

**Response**: standard header (2-byte status + 6-byte MAC) + 11-byte payload with same layout as `SET_FRONT_CONFIG` above.

Decode: each field is un-scaled (`value / 10` for mm fields; integer as-is for `chainringCount`).

---

### BLE_CMD_SET_FRONT_COG_INFO (0x001E) — NEW

**Purpose**: Write front chainring cable-position table (analogous to `SET_REAR_COG_INFO` for the front derailleur).

**Request format**: `reverseCommand(0x001E)` + reversed hub MAC + parameters.

Parameters: repeating 3-byte chunks per chainring.

- Bytes 0–1: cable position in tenths of mm, u16 LE
- Byte 2: chainring tooth count, u8

The number of chunks matches `chainringCount` from the front config (typically 2 for double, 3 for triple).

**Example** (double chainring: 34T at 0.0 mm, 50T at 8.0 mm):

- Chunk 1: `0000 22` (0.0 mm × 10 = 0x0000 LE, 34 teeth = 0x22)
- Chunk 2: `5000 32` (8.0 mm × 10 = 0x0050 LE, 50 teeth = 0x32)
- Payload: `1E00FFEEDDCCBBAA` + `000022500032`

---

### BLE_CMD_GET_FRONT_COG_INFO (0x0020) — NEW

**Purpose**: Read front chainring cable-position table.

**Request format**: `reverseCommand(0x0020)` + reversed hub MAC. No parameters.

**Response**: standard header + repeating 3-byte chunks (same format as SET, u16 LE cable pos × 10 + u8 teeth).

---

### BLE_CMD_START_DFU (0x0021) — NEW (not implemented in current app)

**Purpose**: Initiate Device Firmware Update (DFU) on the connected hub. The opcode is defined in the protocol (`commandNames` map in `catalog.dart`) but **no `startDfu()` function exists** in the current app's Dart code (`bikenet_client.dart` / `bikenet_sdk_facade.dart`). The app also has no firmware download logic — no Firebase Storage fetch, no Nordic DFU library, no HTTP download. The feature appears planned but not yet shipped.

**Request format** (based on protocol definition): `reverseCommand(0x0021)` + reversed hub MAC. No parameters.

**Response**: standard status only. After success, the device would disconnect and re-advertise in DFU mode.

---

### BLE_CMD_GET_FW_VER (0x0025) — NEW

**Purpose**: Read firmware version from the connected device.

**Request format**: `reverseCommand(0x0025)` + reversed target MAC. No parameters.

**Response**: standard header + version payload. Exact byte layout not yet confirmed from decompile; the app displays a version string in the component info sheet.

---

### BLE_CMD_GET_SEATPOST_COUNT (0x0026) — NEW

**Purpose**: Query the number of seatpost devices paired with the hub.

**Request format**: `reverseCommand(0x0026)` + reversed hub MAC. No parameters.

**Response**: standard header + likely 1-byte count. Exact format TBD.

---

### BLE_CMD_PWR_DWN (0x0027) — NEW

**Purpose**: Command the target device to power down.

**Request format**: `reverseCommand(0x0027)` + reversed target MAC. No parameters.

**Response**: standard status only (device will disconnect after ACK).

---

### BLE_CMD_TUNE_MODE (0x0028) — NEW

**Purpose**: Enable or disable tune mode on a pod. Tune mode is assignable as a button function in the app.

**Request format**: `reverseCommand(0x0028)` + reversed target MAC [+ 1-byte mode?]. Exact parameters TBD from assembly; likely a 1-byte on/off flag.

---

## Peripheral notifications (unsolicited)

### Existing messages — codes unchanged

| Code   | Name                   | Notes                                       |
| ------ | ---------------------- | ------------------------------------------- |
| 0x4000 | BLE_MSG_BAT_V          | Battery voltage; unchanged                  |
| 0x4001 | BLE_MSG_BUTTON_ACTION  | Button press/release; unchanged             |

### BLE_MSG_BAT_V (0x4000) — payload format

Source: `parseBatteryVoltageNotify` in open-elin `demo-node/src/commands.ts`.

Full notification frame:

| Offset | Size | Type    | Field       | Notes                            |
| ------ | ---- | ------- | ----------- | -------------------------------- |
| 0      | 2    | —       | pad         | always `00 00`                   |
| 2      | 2    | u16 LE  | opcode      | `00 40` (= 0x4000)               |
| 2      | 6    | bytes   | sender MAC  | 6 bytes (bytes 2–7 of frame)     |
| 8      | 2    | u16 LE  | batteryMv   | **Pod sender**: 2-byte LE mV value |

Note: hub sender uses a different parse path (reversed bytes → big-endian int). Pod firmware must use the 2-byte LE encoding.
| 0x4002 | BLE_MSG_BUTTON_TABLE   | Button map dump; unchanged                  |
| 0x4003 | BLE_MSG_SHIFT_COMPLETE | Shift complete — **payload format changed** |
| 0x4004 | BLE_MSG_FRONT_COG      | Front derailleur position; unchanged        |

### BLE_MSG_SHIFT_COMPLETE (0x4003) — payload changed

Old protocol payload was a raw variable-length hex blob. The new SDK defines a structured 3-byte payload (source: `_decodeShiftComplete` in `catalog.dart`):

| Offset | Size | Type   | Field          | Notes                                        |
| ------ | ---- | ------ | -------------- | -------------------------------------------- |
| 0      | 2    | u16 LE | `positionMm10` | absolute position × 10 (divide by 10 for mm) |
| 2      | 1    | u8     | `gear`         | gear index (0-based)                         |

**Example**:

- Payload bytes: `7B 00 03`
- `positionMm10` = 0x007B = 123 → position = 12.3 mm
- `gear` = 0x03 → gear 3

---

### BLE_MSG_ELINK_FUNCTION (0x2000) — NEW

**Purpose**: Unsolicited notification from an eLink accessory (e.g., seatpost dropper, eLink module) reporting a function event.

**Structure** (from `_decodeELinkFunction` in `catalog.dart`):

- Header: standard 2-byte command (0x2000 as LE = `00 20`) + 6-byte MAC
- Payload: raw bytes (application-specific to the eLink function type)

**ELinkFunctionEvent fields**:

- `mac` — source device MAC string
- `payload` — raw Uint8List, meaning depends on the specific eLink function

Observed function type names (from `objs.txt`):

- `seatpostUnlock` — seatpost locked/extended
- `seatpostLock` — seatpost collapsed/locked

The payload byte(s) likely encode the specific function ID or state. Exact decoding TBD (requires live capture).

---

### BLE_MSG_SHIFT_FRONT (0x2001) — NEW

**Purpose**: Unsolicited notification from the front derailleur when a front shift completes.

**Structure**: standard header + payload TBD (likely mirrors `BLE_MSG_SHIFT_COMPLETE` format with position + gear).

---

## Response / status codes

**Unchanged from old protocol**:

| Code           | Name                     |
| -------------- | ------------------------ |
| 0x8000 (32768) | BLE_STATUS_SUCCESS       |
| 0x8001 (32769) | BLE_STATUS_INVALID_MSG   |
| 0x8002 (32770) | BLE_STATUS_INVALID_PARAM |
| 0x8003 (32771) | BLE_STATUS_INVALID_STATE |
| 0x8004 (32772) | BLE_STATUS_FORBIDDEN     |
| 0x8005 (32773) | BLE_STATUS_NOT_FOUND     |
| 8              | CON_TIMEOUT              |

New exception type in SDK: `ProtocolMismatchException` — thrown when a response payload length does not match expectations (e.g., wrong firmware version for a command).

---

## Manufacturer data / advertisement

**Unchanged**: hub advertises company ID `0xDE98`. Last 6 bytes of manufacturer data = hub BLE MAC reversed.

```
Manufacturer data bytes (example): 08 01 e5 a0 52 ab ba d7
Last 6 bytes reversed → MAC: D7:BA:AB:52:A0:E5
```

---

## Notes for implementers

- **Opcodes 0x0000–0x001A and 0x001D/0x001F are unchanged** from the old protocol. Pod-button command opcodes 0x0022–0x0024 are also unchanged (just renamed). Any third-party client only needs to update if it used the now-incorrect opcode assignments published in earlier drafts of this document.
- **Protocol MAC concept**: the new SDK may send a different "protocol MAC" in the frame than the BLE MAC used for connection. If commands fail with `FORBIDDEN` or `NOT_FOUND`, ensure you are using the hub's BLE MAC (obtainable from advertisement manufacturer data) and not a derived protocol MAC. This is still under investigation.
- **Front derailleur**: `SET_FRONT_COG_INFO` (0x001E) + `SET_FRONT_CONFIG` (0x001B) together configure the front derailleur. Send `SET_FRONT_CONFIG` first to set positions and chain-ring count, then `SET_FRONT_COG_INFO` to write the per-chainring cable table.
- **DFU**: `START_DFU` (0x0021) is defined in the protocol but **not yet implemented** in the app. No firmware download or DFU library is present. If triggered manually, it would disconnect the device; reconnect logic should handle re-advertisement in DFU mode.
- **Seatpost / eLink**: seatpost commands appear via `BLE_MSG_ELINK_FUNCTION` events (code 0x2000). No dedicated write commands for seatpost were found; control may work through `TUNE_MODE` or custom eLink payloads.
- **`BLE_MSG_BUTTON_ACTION` flow**: unchanged — still triggers `GET_POD_BUTTON_LAST_V` (0x0024) after a press event.

---

## Derived from

- `apk-extracted-project-bikenet-new/resources/lib/arm64-v8a/libapp.so` (Dart AOT snapshot)
- Decompiled with blutter (Dart 3.11.0/C++20 build)
- Output: `decompiled-dart/asm/bikenet_sdk/src/` and `decompiled-dart/pp.txt`
- Firebase project: `bikenet2`
