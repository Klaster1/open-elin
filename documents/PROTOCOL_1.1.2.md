# NXS (BikeNet) BLE Protocol — v1.1.2 additions (Flutter/Dart, bikenet2)

This document covers protocol commands that are **new in APK version 1.1.2** (`com.ogbikeworks.bikenet`, versionCode 7) compared to the previously documented build (`PROTOCOL_NEW.md`, from a 1.0.4 build). It only documents what changed — for everything else (framing rules, PIN unlock, button map format, front derailleur commands, etc.) see `PROTOCOL_NEW.md`.

Sources: `decompiled-dart-1.1.2/asm/bikenet_sdk/src/` and `decompiled-dart-1.1.2/pp.txt`, decompiled from `libapp.so` with blutter.

---

## How to read this document

Every command below follows the same request/response envelope as the rest of the protocol:

- **Request**: `reverseCommand(opcode)` (2 bytes, byte-swapped little/big) + reversed target MAC (6 bytes) + optional payload bytes.
- **Response**: 2-byte status code (LE) + 6-byte MAC + optional payload bytes.
- Status `0x8000` = success. Any other code (see table below) is an error; the SDK throws instead of returning payload bytes.
- Multi-byte integers in payloads are **little-endian** unless stated otherwise.

Status codes seen in this build (unchanged from before, listed here for convenience):

| Code   | Name         |
|--------|--------------|
| 0x8000 | success      |
| 0x8001 | invalidMsg   |
| 0x8002 | invalidParam |
| 0x8003 | invalidState |
| 0x8004 | forbidden    |
| 0x8005 | notFound     |
| 0x8006 | connFail     |
| 0x8007 | connSuccess  |
| 0x8008 | disconnected |
| 0x8009 | noResources  |

---

## New commands in this build

| Opcode | Name                                   | Purpose                                       |
|--------|----------------------------------------|-----------------------------------------------|
| 0x0029 | `BLE_CMD_SET_SHIFT_MODE`               | Set shift mode + up to 2 mode parameters      |
| 0x002A | `BLE_CMD_GET_SHIFT_MODE`               | Read shift mode + its 2 mode parameters       |
| 0x002B | `BLE_CMD_GET_BATTERY_V`                | Read battery voltage                          |
| 0x002C | `BLE_CMD_BATTERY_TEST`                 | Run a battery load test, get the voltage drop |
| 0x002D | `BLE_CMD_GET_SYSTEM_STATUS`            | Read live device status snapshot              |
| 0x002E | `BLE_CMD_GET_TELEMETRY`                | Read lifetime usage/error counters            |
| 0x002F | `BLE_CMD_GET_BLE_DISCONNECT_TELEMETRY` | Read BLE disconnect-reason history            |

Opcodes were recovered from the `commandNames()` map in `catalog.dart` (Dart stores them as `opcode × 2`, so divide the raw table value by 2) and cross-checked against the literal opcode argument each command wrapper passes to the low-level send function.

**Correction (confirmed on-device)**: this document previously listed `0x0018` as a new `BLE_CMD_SET_DEV_CONFIG` opcode in this build. That is incorrect — `SET_DEV_CONFIG` already exists at `0x000C` (unchanged since `PROTOCOL_NEW.md`), and `0x0018` is actually `BLE_CMD_GET_SKIP_TABLE` (a read-only 16-byte getter, paired with `SET_SKIP_TABLE` at `0x001A` on the same buffer) exactly as `PROTOCOL_NEW.md` documents. Likely a transcription error in an earlier pass of this document — there is no dedicated `SET_DEV_CONFIG`-at-`0x0018` opcode.

**Correction (confirmed on-device)**: `BLE_CMD_SET_SHIFT_MODE` / `BLE_CMD_GET_SHIFT_MODE` are **not** dead/unused — the app may not call them, but the commands are fully implemented device-side with persisted state (see below). "Not called anywhere in the app" only describes the app-side client.

---

### BLE_CMD_SET_SHIFT_MODE (0x0029) — implemented device-side, unused by app

**Purpose**: Set the shift mode and, depending on payload length, up to two mode-specific parameter bytes. Persisted to flash.

**Request format**: `reverseCommand(0x0029)` + reversed target MAC + 1–3 byte payload.

Payload layout:

| Offset | Size | Field    | Notes                                                                 |
|--------|------|----------|------------------------------------------------------------------------|
| 0      | 1    | `mode`   | Mode selector; must be `< 2` or the device replies `invalidParam`     |
| 1      | 1    | `param1` | Optional. If payload length is exactly 2, this sets **both** mode parameters (see below) |
| 2      | 1    | `param2` | Optional. Only read if payload length is ≥ 3, together with `param1`  |

**Decode/encode algorithm** (observed device behavior):

```
if payload.length == 0: reply invalidParam
if mode >= 2: reply invalidParam
setShiftMode(mode)
if payload.length < 3:
    if payload.length > 1: setShiftModeParamsBoth(param1)   // param1 sets both params at once
else:
    setShiftModeParam1(param1)
    setShiftModeParam2(param2)
persistShiftModeFlash()
reply success
```

**Response**: standard status only, no payload.

**Notes**:

- Exact semantics of `mode` (0/1) and what `param1`/`param2` control are not resolved yet — needs live traffic to document further.
- Not called by the current app; only reachable via a raw protocol client.

---

### BLE_CMD_GET_SHIFT_MODE (0x002A) — implemented device-side, unused by app

**Purpose**: Read back the current shift mode and its two mode parameters.

**Request format**: `reverseCommand(0x002A)` + reversed target MAC. No parameters.

**Response**: standard header + fixed **3-byte** payload.

| Offset | Size | Type | Field    |
|--------|------|------|----------|
| 0      | 1    | u8   | `mode`   |
| 1      | 1    | u8   | `param1` |
| 2      | 1    | u8   | `param2` |

**Notes**:

- Not called by the current app; only reachable via a raw protocol client.

---

### BLE_CMD_GET_BATTERY_V (0x002B) — NEW

**Purpose**: Read the current battery voltage of the target device (hub or pod). Looks like the v1.1.2 replacement/companion for the old `BLE_CMD_GET_LAST_V`.

**Request format**: `reverseCommand(0x002B)` + reversed target MAC. No parameters.

**Response**: standard header + 2-byte payload.

| Offset | Size | Type   | Field       | Unit       |
|--------|------|--------|-------------|------------|
| 0      | 2    | u16 LE | `batteryMv` | millivolts |

**Example** — response payload `E4 0B` → `0x0BE4` = 3044 mV.

---

### BLE_CMD_BATTERY_TEST (0x002C) — NEW

**Purpose**: Ask the target device to run a load test on its battery (briefly apply a load and measure how much the voltage sags), then report the drop. Used by the app before/during a firmware update to make sure the battery can sustain the flash process.

**Request format**: `reverseCommand(0x002C)` + reversed target MAC. No parameters.

**Response**: standard header + 2-byte payload.

| Offset | Size | Type   | Field           | Unit       |
|--------|------|--------|-----------------|------------|
| 0      | 2    | u16 LE | `voltageDropMv` | millivolts |

**Notes**:

- The app treats a drop of more than ~60 mV during firmware update as risky and warns the user ("Battery load test failed") — see `_checkPodBatteryTest` in `dashboard_firmware_update_pilot.dart`. That threshold is an app-side policy, not part of the wire protocol.
- Expect this command to take longer to answer than a plain read, since the device has to run the actual load test before replying.

---

### BLE_CMD_GET_SYSTEM_STATUS (0x002D) — NEW

**Purpose**: Read a live snapshot of device health — pass/fail flags, battery, and encoder readings — with the full telemetry report (see `BLE_CMD_GET_TELEMETRY`) embedded directly in the same response.

**Request format**: `reverseCommand(0x002D)` + reversed target MAC. No parameters.

**Response**: standard header + fixed **0x54 (84)-byte** payload. Any other length is a protocol error.

**Correction (confirmed on-device)**: this document previously claimed the payload is "either 8 or 168 (0xA8) bytes". That was wrong — a successful call always returns a fixed 84-byte payload: an 8-byte status header immediately followed by the complete 76-byte `TelemetryReport` body (identical layout to `BLE_CMD_GET_TELEMETRY`'s response, not a 152-byte truncated/expanded variant). There is no variable-length or optional-telemetry behavior; if the device is busy, the whole command fails with `invalidState` instead of returning a shorter payload.

| Offset | Size | Type   | Field                      | Notes                                                                                          |
|--------|------|--------|----------------------------|--------------------------------------------------------------------------------------------------|
| 0      | 1    | u8     | `systemStatusVersion`      | Payload format version, always `1`                                                              |
| 1      | 1    | u8     | `systemStatusPassFlags`    | Bitfield of self-test pass/fail flags (bit 0 = a persistent fault flag, bits 1–3 = battery/encoder-1/encoder-2 range-check failures) |
| 2      | 2    | u16 LE | `systemStatusBatteryMv`    | Battery voltage, millivolts                                                                      |
| 4      | 2    | i16 LE | `systemStatusEncoder1`     | Signed motor encoder 1 reading                                                                   |
| 6      | 2    | i16 LE | `systemStatusEncoder2`     | Signed motor encoder 2 reading                                                                   |
| 8      | 76   | —      | embedded `TelemetryReport` | Always present. Same layout as the `BLE_CMD_GET_TELEMETRY` response body (see below), starting right after the 8-byte status header. |

**Decode algorithm**:

```
requireLenExact(payload, 84)
version   = readU8(payload, 0)
passFlags = readU8(payload, 1)
batteryMv = readU16LE(payload, 2)
encoder1  = readI16LE(payload, 4)   // signed
encoder2  = readI16LE(payload, 6)   // signed
telemetry = decodeTelemetryPayload(payload[8..84])  // see GET_TELEMETRY, always present
```

**Notes**:

- The encoders are read as signed (two's complement), unlike most other u16 fields in this protocol which are unsigned.
- `systemStatusPassFlags` bits: bit 0 reflects a separate persistent fault flag; bit 1 is set when the just-read battery voltage fails a range check; bits 2 and 3 are set when encoder 1 / encoder 2 fail their own range checks, respectively. Exact pass/fail thresholds are not yet decoded.
- This 84-byte length may be specific to shifter-type devices — other device types (hub, pod) were not verified and could use a different fixed length.

---

### BLE_CMD_GET_TELEMETRY (0x002E) — NEW

**Purpose**: Read lifetime usage and error counters accumulated by the device since manufacture (or since a factory reset).

**Request format**: `reverseCommand(0x002E)` + reversed target MAC. No parameters.

**Response**: standard header + fixed **76-byte** payload. Any other length is a protocol error.

| Offset | Size | Type        | Field                                                                                                     |
|--------|------|-------------|-----------------------------------------------------------------------------------------------------------|
| 0      | 4    | u8 (padded) | `version` — read as u8, occupies first byte only; bytes 1–3 are padding before the next u32-aligned field |
| 4      | 4    | u32 LE      | `factoryResetCount`                                                                                       |
| 8      | 4    | u32 LE      | `autoPairCount`                                                                                           |
| 12     | 4    | u32 LE      | `userButtonResetCount`                                                                                    |
| 16     | 4    | u32 LE      | `holdToHomeResetCount`                                                                                    |
| 20     | 4    | u32 LE      | `powerOffWakeResetCount`                                                                                  |
| 24     | 4    | u32 LE      | `watchdogResetCount`                                                                                      |
| 28     | 4    | u32 LE      | `otherResetCount`                                                                                         |
| 32     | 4    | u32 LE      | `frontShiftCount`                                                                                         |
| 36     | 4    | u32 LE      | `frontShiftFailureCount`                                                                                  |
| 40     | 4    | u32 LE      | `rearShiftCount`                                                                                          |
| 44     | 4    | u32 LE      | `rearShiftFailureCount`                                                                                   |
| 48     | 4    | u32 LE      | `homingAttemptCount`                                                                                      |
| 52     | 4    | u32 LE      | `homingSuccessCount`                                                                                      |
| 56     | 4    | u32 LE      | `homingFailureCount`                                                                                      |
| 60     | 4    | u32 LE      | `lowVoltageStallCount`                                                                                    |
| 64     | 4    | u32 LE      | `chargerConnectCount`                                                                                     |
| 68     | 4    | u32 LE      | `bleDisconnectCount`                                                                                      |
| 72     | 4    | u32 LE      | `dropperCycleCount`                                                                                       |

**Decode algorithm**:

```
requireLenExact(payload, 76)
version                = readU8(payload, 0)
factoryResetCount      = readU32LE(payload, 4)
autoPairCount          = readU32LE(payload, 8)
userButtonResetCount   = readU32LE(payload, 12)
holdToHomeResetCount   = readU32LE(payload, 16)
powerOffWakeResetCount = readU32LE(payload, 20)
watchdogResetCount     = readU32LE(payload, 24)
otherResetCount        = readU32LE(payload, 28)
frontShiftCount        = readU32LE(payload, 32)
frontShiftFailureCount = readU32LE(payload, 36)
rearShiftCount         = readU32LE(payload, 40)
rearShiftFailureCount  = readU32LE(payload, 44)
homingAttemptCount     = readU32LE(payload, 48)
homingSuccessCount     = readU32LE(payload, 52)
homingFailureCount     = readU32LE(payload, 56)
lowVoltageStallCount   = readU32LE(payload, 60)
chargerConnectCount    = readU32LE(payload, 64)
bleDisconnectCount     = readU32LE(payload, 68)
dropperCycleCount      = readU32LE(payload, 72)
```

**Notes**:

- All counters are unsigned 32-bit and presumably saturate rather than wrap on overflow (not confirmed).
- This is the same struct that gets embedded inside `BLE_CMD_GET_SYSTEM_STATUS` when that command's response is 168 bytes long — implement one decoder and reuse it for both.

---

### BLE_CMD_GET_BLE_DISCONNECT_TELEMETRY (0x002F) — NEW

**Purpose**: Read a summary of why the BLE link has dropped over the device's lifetime, plus a short history of the most recent disconnect events.

**Request format**: `reverseCommand(0x002F)` + reversed target MAC. No parameters.

**Response**: standard header + fixed **124-byte** payload.

**Header part** (bytes 0–28):

| Offset | Size | Type   | Field                    |
|--------|------|--------|--------------------------|
| 0      | 1    | u8     | `version`                |
| 4      | 4    | u32 LE | `localRequestCount`      |
| 8      | 4    | u32 LE | `peerRequestCount`       |
| 12     | 4    | u32 LE | `linkLossCount`          |
| 16     | 4    | u32 LE | `securityCount`          |
| 20     | 4    | u32 LE | `connectionFailureCount` |
| 24     | 4    | u32 LE | `otherCount`             |

`categorizedTotal` is not sent on the wire — it's just the sum of the six counters above, computed by the SDK for convenience.

**Recent-events part**: starts right after the 1-byte `recentCount` field (payload offset 1), up to 8 records of 12 bytes each. Field offsets below are relative to the start of each record:

| Offset (from record start) | Size | Type   | Field                                                                                          |
|----------------------------|------|--------|------------------------------------------------------------------------------------------------|
| 0                          | 1    | u8     | `category` (enum, see below)                                                                   |
| 1                          | 1    | u8     | `linkRole` (enum, see below)                                                                   |
| 2                          | 4    | u32 LE | `sequence` — monotonic disconnect counter at the time of this event                            |
| 6                          | 4    | u32 LE | `connectedSeconds` — how long the link had been up before it dropped                           |
| 10                         | 1    | u8     | `hciReason` — raw Bluetooth HCI disconnect reason code                                         |
| 11                         | 1    | i8     | `lastRssiDbm` — signed RSSI just before disconnect (values ≥ 0x80 are negative: `value − 256`) |

**Full byte layout** (all offsets relative to the whole payload):

| Offset              | Size | Field                                                                         |
|---------------------|------|-------------------------------------------------------------------------------|
| 0                   | 1    | `recentCount` (u8, 0–8)                                                       |
| 1                   | 1    | record 0: `category`                                                          |
| 2                   | 1    | record 0: `linkRole`                                                          |
| 3                   | 4    | record 0: `sequence` (u32 LE)                                                 |
| 7                   | 4    | record 0: `connectedSeconds` (u32 LE)                                         |
| 11                  | 1    | record 0: `hciReason` (u8)                                                    |
| 12                  | 1    | record 0: `lastRssiDbm` (i8)                                                  |
| 13                  | ...  | record 1 starts here, same 12-byte layout, and so on for up to 8 records      |
| (after last record) | 1    | `bleDisconnectTelemetryVersion` (u8) — a second version byte for this section |
| +4                  | 4    | `localRequestCount` (u32 LE)                                                  |
| +4                  | 4    | `peerRequestCount` (u32 LE)                                                   |
| +4                  | 4    | `linkLossCount` (u32 LE)                                                      |
| +4                  | 4    | `securityCount` (u32 LE)                                                      |
| +4                  | 4    | `connectionFailureCount` (u32 LE)                                             |
| +4                  | 4    | `otherCount` (u32 LE)                                                         |

In other words: `recentCount` byte, then that many 12-byte disconnect records, then the six u32 category counters (with their own leading version byte). Total payload is fixed at 124 bytes regardless of `recentCount` (unused record slots are presumably zero-filled).

**`category` enum** (`BleDisconnectCategory`):

| Value | Name                |
|-------|---------------------|
| 0     | `unknown`           |
| 1     | `localRequest`      |
| 2     | `peerRequest`       |
| 3     | `linkLoss`          |
| 4     | `security`          |
| 5     | `connectionFailure` |
| 6     | `other`             |

**`linkRole` enum** (`BleDisconnectLinkRole`):

| Value | Name        |
|-------|-------------|
| 0     | `phone`     |
| 1     | `component` |
| 2     | `unknown`   |

**Decode algorithm**:

```
requireLenExact(payload, 124)
recentCount = readU8(payload, 0)
if recentCount > 8: throw ProtocolMismatchException

records = []
for i in range(recentCount):
    base = 1 + i * 12
    category         = enumFromU8(readU8(payload, base + 0), BleDisconnectCategory)
    linkRole         = enumFromU8(readU8(payload, base + 1), BleDisconnectLinkRole)
    sequence         = readU32LE(payload, base + 2)
    connectedSeconds = readU32LE(payload, base + 6)
    hciReason        = readU8(payload, base + 10)
    lastRssiDbm      = readI8(payload, base + 11)   // 0x80-0xFF => value - 256
    records.append({category, linkRole, sequence, connectedSeconds, hciReason, lastRssiDbm})

countersOffset = 1 + 8 * 12   // = 97, fixed regardless of recentCount
version                 = readU8(payload, countersOffset)
localRequestCount       = readU32LE(payload, countersOffset + 4)
peerRequestCount        = readU32LE(payload, countersOffset + 8)
linkLossCount           = readU32LE(payload, countersOffset + 12)
securityCount           = readU32LE(payload, countersOffset + 16)
connectionFailureCount  = readU32LE(payload, countersOffset + 20)
otherCount              = readU32LE(payload, countersOffset + 24)
categorizedTotal = localRequestCount + peerRequestCount + linkLossCount
                 + securityCount + connectionFailureCount + otherCount
```

**Notes**:

- `hciReason` is the raw Bluetooth HCI disconnect reason (per the Bluetooth Core spec's "Error Codes" table, e.g. `0x08` = connection timeout, `0x13` = remote user terminated). Decode it against the standard HCI error code list if you need human-readable reasons.
- `lastRssiDbm` uses two's-complement encoding in a single byte; treat any value ≥ 0x80 as negative (`value − 256`).
- Because the record slot count is fixed at 8 regardless of `recentCount`, always trust `recentCount` to know how many leading records are valid — don't read past it.

---

## Summary of what did *not* change in this build

- No new `BLE_MSG_*` peripheral notification types beyond the ones already documented in `PROTOCOL_NEW.md` (`BAT_V`, `BUTTON_ACTION`, `BUTTON_TABLE`, `SHIFT_COMPLETE`, `FRONT_COG`, `ELINK_FUNCTION`, `SHIFT_FRONT`).
- No new `DashboardButtonFunction` codes — the assignable pod-button actions are unchanged.
- No new front derailleur commands beyond what `PROTOCOL_NEW.md` already documents.
- `BLE_CMD_START_DFU` (0x0021) is still unused by the app, same as before — see `PROTOCOL_NEW.md`'s entry for it; this is purely an app-side gap.
