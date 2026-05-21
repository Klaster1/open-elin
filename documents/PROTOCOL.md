# NXS (BikeNet) BLE Protocol — Reverse-engineering notes

This document summarizes protocol findings extracted from the decompiled NXS Android app (APK sources). It explains discovery, advertisement parsing, command encoding, response codes, and gives concrete examples and a Web Bluetooth snippet.

## Service & Characteristic UUIDs

- Service: `A5C1C000-CC20-BA91-0C1A-EF3F9E643D79`
- MSG characteristic (write/notify): `A5C1CC01-CC20-BA91-0C1A-EF3F9E643D79`
- PIN characteristic (write/notify): `A5C1CC02-CC20-BA91-0C1A-EF3F9E643D79`

Source: `com/bikenet/utils/Constants.java`

### Which device exposes the characteristics?

The app connects to the hub (eLink) that advertises the BikeNet service UUID, then discovers the MSG and PIN characteristics on that same service. Pods themselves don’t expose the MSG/PIN characteristics in the app’s flow; the hub mediates pod actions.

## How devices are discovered

- Scanning uses Nordic `BluetoothLeScannerCompat` and `ScanFilter`s built from the BIKE_NET service UUID.
- Manufacturer-specific advertisement bytes are parsed with `DeviceMetadata.fromByteArray(...)` to extract deviceId, deviceType and flags. See `BluetoothScannerKt.toBikeNetDevice`.

## Auth / handshake (PIN unlock)

The app performs a PIN unlock before issuing protected commands (e.g., GET_LIST). It writes the PIN to the PIN characteristic and waits for an `0x01` notification (PIN accepted).

- PIN characteristic: `A5C1CC02-CC20-BA91-0C1A-EF3F9E643D79`
- Default PIN in app: `1111` (`Constants.DEFAULT_PIN`)
- PIN is encoded as a nibble-prefixed hex string (e.g., "1111" → `01 01 01 01`)
- If you receive `BLE_STATUS_FORBIDDEN`, send PIN first, then retry the command.

## Step-by-step execution flow (how to implement)

1. **Scan** for devices advertising the BikeNet service UUID.
2. **Connect** to the hub (eLink).
3. **Subscribe** to notifications on both MSG and PIN characteristics.
4. **Unlock (PIN)** by writing the PIN to the PIN characteristic and waiting for `0x01` notification.
5. **Build command payload**:

- Use `reverseCommand(cmd)` to swap the 2-byte command hex (e.g., `0x0016` → `1600`).
- Use `reverseMacAddress(mac)` to reverse MAC byte order and remove colons (e.g., `AA:BB:CC:DD:EE:FF` → `FFEEDDCCBBAA`).
- Concatenate `reversed-command + reversed-MAC + params` (if required by the command).
- For special cases (button map write, tuning button read), send the prebuilt payload exactly as described.

6. **Write** payload to MSG characteristic.
7. **Wait for response**:

- Standard responses start with 2-byte response code (e.g., `0x8000` success).
- Some actions also emit peripheral notifications (e.g., `BLE_MSG_BUTTON_TABLE`).

8. **Handle errors**:

- `BLE_STATUS_FORBIDDEN`: re-send PIN, then retry.
- `BLE_STATUS_INVALID_PARAM/STATE`: fix parameters/state and retry.
- `CON_TIMEOUT`: retry with longer timeout or re-connect.

9. **Process notifications** as unsolicited events (button actions, shift complete, battery, etc.).

## Encoding rules / framing

- Most AppCommands are encoded as: `reversed-command` + `reversed-MAC` [+ extra fields].
  - `reverseCommand("0x0016")` => takes the hex string (no `0x`) and swaps the two 2-digit nibbles -> e.g. `0016` -> `1600` (see `UtilsKt.reverseCommand`).
  - `reverseMacAddress(mac)` reverses the MAC byte order (e.g. `AA:BB:CC:DD:EE:FF` -> `FF:EE:DD:CC:BB:AA`) and removes colons.
  - Resulting hex string is decoded to bytes via `UtilsKt.decodeHex(...)`.
- Numeric parameters use little-endian byte packing (`UtilsKt.toByteArray(number, n)`), and when included in combined hex strings some helpers reverse arrays before appending.
- `Message.toByteArray()` contains special cases; see command-table below.

## AppCommands (one section per command)

Rules: if not noted explicitly in a command section, `Message.toByteArray()` uses the default branch: 2-byte little-endian ordinal + reversed MAC + parameters.

### BLE_CMD_GET_LIST (0x0000)

**Purpose**: Fetch paired peripherals from the hub (pods). The hub itself does not appear in this list.

**App trace**:

- `BikeNetSystem.getDeviceList()` queues `new Message(BLE_CMD_GET_LIST, getAddress(), null, null, ...)`, then `send()`.

**Request format**:

- `reverseCommand(0x0000)` + reversed hub MAC. No parameters.

**Response format (payload)**: repeated 27-byte entries.

- 6 bytes: MAC address (reversed when displayed, same as other responses).
- 16 bytes: device name bytes (UTF-8), trailing `00` bytes are trimmed.
- 1 byte: deviceId.
- 1 byte: isConnected (1 = connected, 0 = not connected).
- 2 bytes LE: batteryVoltage (millivolts).
- 1 byte: RSSI (unsigned byte as reported by the device).

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Request payload hex: `0000FFEEDDCCBBAA`.
- Single-entry payload bytes:
  - `AA BB CC DD EE FF 4E 58 53 2D 50 4F 44 00 00 00 00 00 00 00 00 00 05 01 E4 0B C8`.
- Parse fields:
  - MAC: `FF:EE:DD:CC:BB:AA`
  - Name: `NXS-POD`
  - deviceId: `05`
  - isConnected: `01`
  - batteryVoltage: `0x0BE4` -> $3044$ mV
  - RSSI: `C8`

### BLE_CMD_ADD_DEVICE (0x0001)

**Purpose**: Pair/register a pod with the hub.

**App trace**:

- `BikeNetSystem.addDevice(device)` queues `new Message(BLE_CMD_ADD_DEVICE, getAddress(), device.getAddress(), null, ...)`, then `send()`.
- `Message.toByteArray()` uses `combineCommandAndMacAndPodMac("0x0001", hubMac, podMac)`.

**Request format**:

- `reverseCommand(0x0001)` + reversed hub MAC + reversed pod MAC.

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Pod MAC: `11:22:33:44:55:66`.
- Payload hex: `0100FFEEDDCCBBAA665544332211`.

### BLE_CMD_REMOVE_DEVICE (0x0002)

**Purpose**: Remove a paired pod from the hub.

**App trace**:

- `BikeNetSystem.removeDevice(address)` queues `new Message(BLE_CMD_REMOVE_DEVICE, getAddress(), null, reversed(address), ...)`, then `send()`.
- Parameters are the reversed pod MAC bytes.

**Request format**:

- Default branch: ordinal (`0x0002` LE) + reversed hub MAC + reversed pod MAC (as parameters).

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Pod MAC: `11:22:33:44:55:66`.
- Payload hex: `0200FFEEDDCCBBAA665544332211`.

### BLE_CMD_SET_PIN (0x0003)

**Purpose**: Set/update the hub PIN (not the same as the PIN unlock write).

**App trace**:

- `BikeNetSystem.setPin(pinCode)` queues `new Message(BLE_CMD_SET_PIN, getAddress(), null, decodeHex(processPIN(pin)), ...)`, then `send()`.
- `Message.toByteArray()` uses `combineCommandAndMac("0x0003", hubMac)` + parameters.

**Request format**:

- `reverseCommand(0x0003)` + reversed hub MAC + PIN bytes.
- PIN bytes: each digit prefixed with `0` and hex-decoded. Example: "1111" -> `01 01 01 01`.

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- PIN: `1111` -> `01 01 01 01`.
- Payload hex: `0300FFEEDDCCBBAA01010101`.

**Related**: PIN unlock uses the PIN characteristic (not this command) and expects a `0x01` notify.

### BLE_CMD_BLINK_LED (0x0004)

**Purpose**: Blink a device LED for identification.

**App trace**:

- `BikeNetSystem.blinkDeviceLed(address)` queues `new Message(BLE_CMD_BLINK_LED, address, null, null, ...)`, then `send()`.

**Request format**:

- `reverseCommand(0x0004)` + reversed target MAC. No parameters.

**Example**:

- Target MAC: `AA:BB:CC:DD:EE:FF`.
- Payload hex: `0400FFEEDDCCBBAA`.

### BLE_CMD_SET_BIKENET (0x0005)

**Purpose**: Put hub into “BikeNet” mode (setup/enable). No parameters.

**App trace**:

- `BikeNetSystem.setBikeNet(true)` queues `new Message(BLE_CMD_SET_BIKENET, getAddress(), null, null, ...)`, then `send()`.
- Called during `BikeNetSystem.setup(...)` before `setName(...)` and `unlock(pin)`.

**Request format**:

- `reverseCommand(0x0005)` + reversed hub MAC. No parameters.

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Payload hex: `0500FFEEDDCCBBAA`.

### BLE_CMD_RESET_BIKENET (0x0006)

**Purpose**: Reset/clear hub BikeNet configuration.

**App trace**:

- `BikeNetSystem.resetBikeNet()` queues `new Message(BLE_CMD_RESET_BIKENET, getAddress(), null, null, ...)`, then `send()`.

**Request format**:

- `reverseCommand(0x0006)` + reversed hub MAC. No parameters.

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Payload hex: `0600FFEEDDCCBBAA`.

### BLE_CMD_DISCONNECT_DEVICE (0x0007)

**Purpose**: Disconnect a device by MAC (typically a pod).

**App trace**:

- `BikeNetSystem.disconnectDevice(address)` queues `new Message(BLE_CMD_DISCONNECT_DEVICE, getAddress(), null, reversed(address), ...)`, then `send()`.

**Request format**:

- Default branch: ordinal (`0x0007` LE) + reversed hub MAC + reversed target MAC (as parameters).

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Pod MAC: `11:22:33:44:55:66`.
- Payload hex: `0700FFEEDDCCBBAA665544332211`.

### BLE_CMD_RECONNECT_DEVICE (0x0008)

**Purpose**: Reconnect a previously paired device by MAC.

**App trace**:

- `BikeNetSystem.reconnectDevice(address)` queues `new Message(BLE_CMD_RECONNECT_DEVICE, getAddress(), null, reversed(address), ...)`, then `send()`.
- Immediately calls `getDeviceList()` after sending.

**Request format**:

- Default branch: ordinal (`0x0008` LE) + reversed hub MAC + reversed target MAC (as parameters).

**Example**:

- Hub MAC: `AA:BB:CC:DD:EE:FF`.
- Pod MAC: `11:22:33:44:55:66`.
- Payload hex: `0800FFEEDDCCBBAA665544332211`.

### BLE_CMD_SET_NAME (0x0009)

**Purpose**: Set device name (hub or pod, depending on target MAC).

**App trace**:

- Hub name: `BikeNetSystem.setName(name, executeNow)` uses UTF-8 bytes of full string (no padding).
- Pod name: `BikeNetSystem.setDeviceName(name, podAddress)` builds a fixed 16-byte array (per-character UTF-8 first byte + `00` padding).

**Request format**:

- `reverseCommand(0x0009)` + reversed target MAC + name bytes.

**Examples**:

- Hub rename (raw UTF-8):
  - Name: `NXS-HUB` -> bytes `4E 58 53 2D 48 55 42`.
  - Payload hex: `0900` + `FFEEDDCCBBAA` + `4E58532D485542`.
- Pod rename (16 bytes):
  - Name: `NXS-POD` -> `4E 58 53 2D 50 4F 44` + 9 bytes `00`.
  - Payload hex: `0900` + `FFEEDDCCBBAA` + `4E58532D504F44000000000000000000`.

### BLE_CMD_CALIBRATE (0x000B)

**Purpose**: Calibrate derailleur/motor.

**App trace**:

- `BikeNetSystem.calibrate()` queues `new Message(BLE_CMD_CALIBRATE, getAddress(), null, null, ...)`, then `send()`.

**Request format**:

- `reverseCommand(0x000B)` + reversed MAC. No parameters.

**Example**:

- Payload hex: `0B00FFEEDDCCBBAA`.

### BLE_CMD_CREATE_SHIFT_TABLE (0x000C)

**Purpose**: Create shift table from gear settings.

**App trace**:

- `BikeNetSystem.createShiftTable(numberOfGears, lowGear, highGear)` builds parameters and sends `BLE_CMD_CREATE_SHIFT_TABLE`.

**Request format**:

- `reverseCommand(0x000C)` + reversed MAC + parameters.
- Parameters:
  - 1 byte: numberOfGears.
  - 2 bytes LE: lowGear.
  - 2 bytes LE: highGear.

**Example**:

- `numberOfGears = 11`, `lowGear = 120`, `highGear = 230`.
- Parameters bytes: `0B 78 00 E6 00`.
- Payload hex: `0C00FFEEDDCCBBAA0B7800E600`.

### BLE_CMD_INCREMENT_MOVE (0x000D)

**Purpose**: Move by an incremental step.

**App trace**:

- `BikeNetSystem.createIncrementMove(increment)` sends `BLE_CMD_INCREMENT_MOVE`.
- `Message.toByteArray()` uses `combineCommandAndMac("0x000D", mac)` + parameters.

**Request format**:

- `reverseCommand(0x000D)` + reversed MAC + 1-byte increment.
- Increment byte: `(increment * 10)` cast to byte (no clamp, no round).

**Example**:

- `increment = 1.5` -> `15` -> `0F`.
- Payload hex: `0D00FFEEDDCCBBAA0F`.

### BLE_CMD_ABSOLUTE_MOVE (0x000E)

**Purpose**: Move to an absolute position.

**App trace**:

- `BikeNetSystem.absoluteMove(pos)` builds parameters and sends `BLE_CMD_ABSOLUTE_MOVE`.

**Request format**:

- `reverseCommand(0x000E)` + reversed MAC + 2-byte LE position.
- Parameters (app behavior):
  - `intValue = (int)(absoluteMove * 10)`.
  - Convert to hex, left-pad to 4 hex chars (`unSignedHex`), decode to bytes.
  - Reverse bytes to little-endian order.

**Example**:

- `absoluteMove = 12.3` -> `intValue = 123` -> hex `007B` -> LE bytes `7B 00`.
- Payload hex: `0E00` + `FFEEDDCCBBAA` + `7B00`.

### BLE_CMD_UPDATE_POSITION (0x000F)

**Purpose**: Commit/confirm current position.

**App trace**:

- `BikeNetSystem.updatePosition(pos)` sends `BLE_CMD_UPDATE_POSITION` with parameters.

**Request format**:

- `reverseCommand(0x000F)` + reversed MAC. No parameters in app.

**Response**:

- Standard status code only (`0x8000` success). The app sets `isUpdatePositionSuccessful` on success.

### BLE_CMD_SHIFT_UP (0x0010)

**Purpose**: Shift up one gear.

**App trace**:

- `BikeNetSystem.shiftUp()` sends `BLE_CMD_SHIFT_UP` with no parameters.
- `Message.toByteArray()` uses `combineCommandAndMac("0x0010", mac)`.

**Request format**:

- `reverseCommand(0x0010)` + reversed MAC. No parameters.

**Example**:

- Payload hex: `1000FFEEDDCCBBAA`.

### BLE_CMD_SHIFT_DOWN (0x0011)

**Purpose**: Shift down one gear.

**App trace**:

- `BikeNetSystem.shiftDown()` sends `BLE_CMD_SHIFT_DOWN` with no parameters.
- `Message.toByteArray()` uses `combineCommandAndMac("0x0011", mac)`.

**Request format**:

- `reverseCommand(0x0011)` + reversed MAC. No parameters.

**Example**:

- Payload hex: `1100FFEEDDCCBBAA`.

### BLE_CMD_MOVE_TO_COG (0x0012)

**Purpose**: Move to target cog (uses previously set position/gear data).

**App trace**:

- `BikeNetSystem.moveToCog(cogIndex)` sends `BLE_CMD_MOVE_TO_COG` with parameters set by `createMoveToCog`.

**Request format**:

- `reverseCommand(0x0012)` + reversed MAC. No parameters in app.

**Response**:

- Standard status code only.

### BLE_CMD_GET_POSITION (0x0013)

**Purpose**: Read current position.

**App trace**:

- `BikeNetSystem.getPosition()` sends `BLE_CMD_GET_POSITION`.

**Request format**:

- `reverseCommand(0x0013)` + reversed MAC. No parameters.

**Response format (payload)**:

- Bytes 0..1: absolute position in tenths, little-endian.
- Bytes 2..end: gear index (parsed as big-endian hex string), then app adds 1 for display.

**Example**:

- Payload bytes: `7B 00 03`.
- Absolute position: `0x007B / 10 = 12.3`.
- Gear index: `0x03 + 1 = 4`.

### BLE_CMD_WRITE_BUTTON_MAP (0x0014)

**Purpose**: Write full button map payload.

**App trace**:

- `BikeNetSystem.sendMapData(...)` builds a full pre-encoded payload string and sends it via `new Message(BLE_CMD_WRITE_BUTTON_MAP, null, null, parameters, ...)`.
- `Message.toByteArray()` special-cases this command and returns `parameters` directly.

**Request format**:

- Payload is the prebuilt byte array. No command or MAC is added by `Message.toByteArray()`.

**Map size payload (app)**:

- Built by `sendMapSize(address, count)` as a hex string and then `decodeHex`.
- Base: `MAP_TABLE` (`1400`) + reversed hub MAC.
- If `count == 0`: append `000000`.
- Else append `00` + size marker:
  - If `isDefaultPodMapping` is true: append `20` (single byte).
  - Else: append `hex(count * 16)` + `00` (size in bytes + trailing `00`).

**Map entry payload (app)**:

- Built in `MapButtonsFragment` as:
  - `MAP_TABLE` (`1400`)
  - reversed hub MAC
  - `SEND_MAP` (`01`)
  - reversed pod MAC
  - reversed eLink (hub) MAC
  - `button1` (1 byte)
  - `button2` (1 byte)
  - `action` (1 byte)
  - `function` (1 byte)

**Example (single map entry)**:

- Hub MAC: `AA:BB:CC:DD:EE:FF` -> `FFEEDDCCBBAA`.
- Pod MAC: `11:22:33:44:55:66` -> `665544332211`.
- Entry: `button1=01`, `button2=FF`, `action=00`, `function=0A`.
- Payload hex:
  - `1400` + `FFEEDDCCBBAA` + `01` + `665544332211` + `FFEEDDCCBBAA` + `01FF000A`.

### BLE_CMD_READ_BUTTON_MAP (0x0015)

**Purpose**: Read current button map.

**App trace**:

- `BikeNetSystem.readButtonMap(address)` sends `BLE_CMD_READ_BUTTON_MAP`.
- `Message.toByteArray()` uses `combineCommandAndMac("0x0015", mac)`.

**Request format**:

- `reverseCommand(0x0015)` + reversed MAC. No parameters.

**Response handling (app)**:

- If payload length > 0: reverse the payload bytes, then hex-encode to an uppercase string.
- If payload length is 0: set a "No data from button map" message.

**Entry format** (inferred from BLE_MSG_BUTTON_TABLE and map upload logic):

- 16 bytes per entry:
  - pod MAC (6 bytes)
  - hub MAC (6 bytes)
  - button1 (1 byte)
  - button2 (1 byte)
  - action (1 byte)
  - function (1 byte)
- Button2 is often `FF` for single-button mappings.

**Example**:

- Reversed payload hex (as logged by app): `AABBCCDDEEFF1122334455660102000A`.
- Decode fields:
  - pod MAC: `AA:BB:CC:DD:EE:FF`
  - hub MAC: `11:22:33:44:55:66`
  - button1: `01`
  - button2: `02`
  - action: `00`
  - function: `0A`

### BLE_CMD_SET_MOTOR_PARAMS (0x0016)

**Purpose**: Write motor tuning parameters.

**App trace**:

- `BikeNetSystem.setMotorParams(...)` builds parameters and sends `BLE_CMD_SET_MOTOR_PARAMS`.

**Request format**:

- `reverseCommand(0x0016)` + reversed MAC + parameters.
- Parameters are 7 fields packed little-endian and concatenated in this order (from `MotorTuningFragment.getUpdatedValuesString()`):
  1. stallDetection (2 bytes LE)
  2. pwmFrequency (4 bytes LE)
  3. accelRampTimer (2 bytes LE)
  4. rampStartDutyCycle (1 byte)
  5. overshiftDistance (2 bytes LE)
  6. overshiftDelay (2 bytes LE)
  7. multishiftDelay (2 bytes LE)
- The app only sends if all 7 fields are provided.

**Example**:

- stallDetection=2000 -> `D0 07`
- pwmFrequency=20000 -> `20 4E 00 00`
- accelRampTimer=100 -> `64 00`
- rampStartDutyCycle=5 -> `05`
- overshiftDistance=2 -> `02 00`
- overshiftDelay=200 -> `C8 00`
- multishiftDelay=300 -> `2C 01`
- Parameters hex: `D007204E00006400050200C8002C01`.

### BLE_CMD_GET_MOTOR_PARAMS (0x0017)

**Purpose**: Read motor tuning parameters.

**App trace**:

- `BikeNetSystem.getMotorParams()` sends `BLE_CMD_GET_MOTOR_PARAMS`.

**Request format**:

- `reverseCommand(0x0017)` + reversed MAC. No parameters.

**Response format (payload)**: 15 bytes total, parsed as 7 values.

- Bytes 0..1: stallDetection (2 bytes LE)
- Bytes 2..5: pwmFrequency (4 bytes LE)
- Bytes 6..7: accelRampTimer (2 bytes LE)
- Byte 8: rampStartDutyCycle (1 byte)
- Bytes 9..10: overshiftDistance (2 bytes LE)
- Bytes 11..12: overshiftDelay (2 bytes LE)
- Bytes 13..14: multishiftDelay (2 bytes LE)

**App parsing**:

- Each field is reversed (LE) then parsed as hex to int with `getDecimalFromHex`.

### BLE_CMD_MOTOR_HOME (0x0019)

**Purpose**: Home/zero the motor.

**App trace**:

- `BikeNetSystem.motorHome()` sends `BLE_CMD_MOTOR_HOME`.

**Request format**:

- `reverseCommand(0x0019)` + reversed MAC. No parameters.

### BLE_CMD_SET_REAR_COG_INFO (0x001D)

**Purpose**: Write rear cog (cassette) setup.

**App trace**:

- `BikeNetSystem.setRearCog(...)` constructs a per-gear cable-position array and sends `BLE_CMD_SET_REAR_COG_INFO`.

**Request format**:

- `reverseCommand(0x001D)` + reversed MAC + parameters.
- Parameters: repeating 3-byte chunks per gear: 2-byte LE cable position in tenths + 1 byte teeth.

**Parameter construction (app)**:

- Inputs: `gearCount`, `smallCog`, `largeCog`, and list of `Cog` items (uses `Cog.getTeeth()` only).
- Compute step: $d = (largeCog - smallCog) / (gearCount - 1)$.
- For each gear index $i$ in $[0, gearCount-1]$:
  - `cable = ((i * d) + smallCog) * 10.0`, cast to int.
  - Convert to 4-hex char, swap bytes (LE), append teeth byte.

**Example (2 gears)**:

- `gearCount=2`, `smallCog=1.2`, `largeCog=3.0`, `cogs=[12, 15 teeth]`.
- `d=1.8`; cable values in tenths: `12` and `30`.
- Hex chunks: `0x000C` -> `0C00`, teeth `0C`; `0x001E` -> `1E00`, teeth `0F`.
- Parameters hex: `0C000C1E000F`.

**Example (11 cogs, positions provided directly; no calculation)**:

- Cable positions: `1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21`.
- Convert to tenths: `10, 30, 50, 70, 90, 110, 130, 150, 170, 190, 210`.
- Convert each to 2-byte LE:
  - `0x000A -> 0A00`, `0x001E -> 1E00`, `0x0032 -> 3200`, `0x0046 -> 4600`, `0x005A -> 5A00`
  - `0x006E -> 6E00`, `0x0082 -> 8200`, `0x0096 -> 9600`, `0x00AA -> AA00`, `0x00BE -> BE00`, `0x00D2 -> D200`
- Append 1 byte teeth per cog (use `00` as placeholder if unknown).
- Parameters hex with placeholder teeth:
  - `0A00001E00003200004600005A00006E0000820000960000AA0000BE0000D20000`

### BLE_CMD_GET_REAR_COG_INFO (0x001F)

**Purpose**: Read rear cog info.

**App trace**:

- `BikeNetSystem.getRearCog()` sends `BLE_CMD_GET_REAR_COG_INFO`.

**Request format**:

- `reverseCommand(0x001F)` + reversed MAC. No parameters.

**Response parsing (app)**:

- Reverse the payload bytes, then hex-encode to uppercase.
- Chunk the hex string into 6-hex groups (3 bytes each).
- Reverse chunk order, then for each chunk:
  - Drop the first byte.
  - Parse the last 2 bytes as hex, divide by 10.
- The first byte is ignored (teeth or padding in practice).

**Example (step-by-step parsing, 11 cogs)**:

- Payload bytes (before app parsing), 3 bytes per cog (LE cable + teeth=00):
  - `0A 00 00 1E 00 00 32 00 00 46 00 00 5A 00 00 6E 00 00 82 00 00 96 00 00 AA 00 00 BE 00 00 D2 00 00`.
- Reverse bytes (entire payload):
  - `00 00 D2 00 00 BE 00 00 AA 00 00 96 00 00 82 00 00 6E 00 00 5A 00 00 46 00 00 32 00 00 1E 00 00 0A`.
- Hex string:
  - `0000D20000BE0000AA00009600008200006E00005A00004600003200001E00000A`.
- Chunk into 6-hex groups, reverse chunk order:
  - `00000A`, `00001E`, `000032`, `000046`, `00005A`, `00006E`, `000082`, `000096`, `0000AA`, `0000BE`, `0000D2`.
- Drop first byte and parse last 2 bytes, divide by 10:
  - `00000A` -> $1.0$, `00001E` -> $3.0$, `000032` -> $5.0$, `000046` -> $7.0$, `00005A` -> $9.0$
  - `00006E` -> $11.0$, `000082` -> $13.0$, `000096` -> $15.0$, `0000AA` -> $17.0$, `0000BE` -> $19.0$, `0000D2` -> $21.0$.

### BLE_CMD_SET_TUNING_BUTTON_LEVEL (0x0022)

**Purpose**: Write tuning button levels.

**App trace**:

- `BikeNetSystem.setTuningButtonLevel(...)` sends `BLE_CMD_SET_TUNING_BUTTON_LEVEL` with parameters.

**Request format**:

- `reverseCommand(0x0022)` + reversed pod MAC + parameters.
- Parameters are concatenated 2-byte little-endian levels, one per tuning button (built in `ButtonTuningFragment.getUpdateLevelString()`).

**Example**:

- Levels [300, 450] -> `2C 01` + `C2 01`.
- Parameters hex: `2C01C201`.
- Payload hex (pod MAC `11:22:33:44:55:66`): `2200` + `665544332211` + `2C01C201`.

### BLE_CMD_READ_TUNING_BUTTON (0x0023)

**Purpose**: Read tuning button levels.

**App trace**:

- `BikeNetSystem.readTuningButton(address)` sends a prebuilt payload and uses `BLE_CMD_READ_TUNING_BUTTON`.
- `Message.toByteArray()` returns `parameters` directly for this command.

**Request format**:

- App sends hex `2300` + reversed MAC (no colons) as the full payload.

**Response format (payload)**:

- List of 2-byte LE ints, one per tuning button.

**Example**:

- Request for pod MAC `11:22:33:44:55:66`:
  - Payload hex: `2300` + `665544332211`.
- Response payload bytes: `2C 01 C2 01` -> levels `[300, 450]`.

### BLE_CMD_GET_LAST_V (0x0024)

**Purpose**: Fetch last button "level" after a button-action notification.

**App trace**:

- Triggered only after a `BLE_MSG_BUTTON_ACTION` notification with action flag `00` (press).
- The app extracts hub MAC from the notification, stores the button label, then sends `GET_LAST_V`.

**Request format**:

- `reverseCommand(0x0024)` + reversed MAC. No parameters.

**Response format (app parsing)**:

- Response is handled as a full message (not sliced at byte 8).
- Bytes 2..8 are the MAC address, reversed before comparison.
- Bytes 8..end are the level value, reversed, then parsed as hex to int.

**Example flow**:

- Receive `BLE_MSG_BUTTON_ACTION`:
  - MAC bytes: `AA BB CC DD EE FF` (bytes 2..8).
  - Button id: `01` (byte 8).
  - Action flag: `00` (byte 9) -> press.
- App calls `GET_LAST_V` for MAC `FF:EE:DD:CC:BB:AA`.
- Suppose response bytes (full message) are: `00 80 AA BB CC DD EE FF 2C 01`.
- Parse level: reverse `2C 01` -> `01 2C` -> hex `012C` -> decimal `300`.

### BLE_APP_ACTION (0xFFFF)

**Purpose**: App-side queue marker (e.g., indication to disconnect). Not sent to device.

## Response codes and peripheral messages

- `ResponseCommand` values (ints):
  - `BLE_STATUS_SUCCESS` = 32768 (0x8000)
  - `BLE_STATUS_INVALID_MSG` = 32769
  - `BLE_STATUS_INVALID_PARAM` = 32770
  - `BLE_STATUS_INVALID_STATE` = 32771
  - `BLE_STATUS_FORBIDDEN` = 32772
  - `BLE_STATUS_NOT_FOUND` = 32773
  - `CON_TIMEOUT` = 8
- `PeripheralCommand` (from peripheral to central):
  - `BLE_MSG_BAT_V` = 16384 — unsolicited battery voltage notification from peripheral to central. Payload format (from `parseBatteryVoltageNotify` in open-elin `commands.ts`):
    - Full notification frame: `[2 pad bytes] [opcode 0x4000 LE u16] [sender MAC 6 bytes] [voltage bytes]`
    - **Pod** (non-hub sender): voltage bytes are a **2-byte LE u16 (mV)** at frame offset 8–9.
    - **Hub** sender: voltage bytes reversed then parsed as big-endian hex int (different path, not relevant for pod firmware).
  - `BLE_MSG_BUTTON_ACTION` = 16385 — device notifies button event; app extracts MAC and button id, then calls `BLE_CMD_GET_LAST_V`
  - `BLE_MSG_BUTTON_TABLE` = 16386
  - `BLE_MSG_SHIFT_COMPLETE` = 16387
  - `BLE_MSG_FRONT_COG` = 16388 — app logs hex only (no further handling)

## Helpers and important utils (names from the code)

- `UtilsKt.decodeHex(hexString)` → hex to byte[]
- `UtilsKt.reverseCommand(cmdHexNoPrefix)` → reorders 4-digit command hex (e.g. `0016` → `1600`)
- `UtilsKt.reverseMacAddress(mac)` → reverses MAC pair order and returns colon-separated reversed string
- `UtilsKt.toByteArray(number, n)` → little-endian byte array of `number` length `n`
- PIN processing uses `toPinCodeByteArray(...)` and a `processPIN(pin)` that formats into hex string before decode.

## Quick Web Bluetooth (JavaScript) helper snippet

```js
// helpers
function hexToUint8Array(hex) {
  if (hex.length % 2 !== 0) throw new Error("odd hex length");
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  return arr;
}

// reverseCommand and reverseMac should follow same logic as UtilsKt (implement accordingly)

async function sendMsg(device, msgHex) {
  const SERVICE = "a5c1c000-cc20-ba91-0c1a-ef3f9e643d79";
  const MSG_CHAR = "a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79";
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE);
  const char = await service.getCharacteristic(MSG_CHAR);
  const bytes = hexToUint8Array(msgHex);
  await char.writeValue(bytes);
}
```

## Notes & cautions

- The app uses Nordic BLE libraries and enables notifications on both MSG and PIN characteristics — subscribe to notifications when reproducing the client.
- Some commands expect the app to pre-build complex parameter arrays (e.g., button map writes). Reverse those by inspecting the app's `mapFullCommand`/`sendMapData` code paths in `BikeNetSystem.java` if needed.
- Respect device pairing/protection: changing device PIN or other destructive commands may brick device behavior; test carefully on a non-critical device.

---

File created from decompiled sources in `apk-extracted-project/sources/com/bikenet`.

If you want, I can:

- Add full byte examples for a handful of commands with sample MACs.
- Produce a ready Web Bluetooth HTML file that performs scan/connect/subscribe and exposes a small UI to send SHIFT/GET_POSITION/ADD_DEVICE.

Acknowledgements: derived from `BikeNetSystem.java`, `Message.java`, `AppCommand.java`, `UtilsKt.java`, and `Constants.java`.

Potential MAC address workaround:

- Make elink device pairable
  This helps with issue that you can listen for adverts on windows
  And these contain man data with mac
- Grab manufacturer data
- Extract mac from there
- Its either that or adjust protocol to not require mac or work with a noop mac (like, all 0s)

## Manufacturer data MAC extraction (Web Bluetooth workaround)

Some platforms (macOS) allow `watchAdvertisements()` and expose manufacturer data. The BikeNet hub advertises company ID `0xDE98`. The manufacturer data appears to embed the hub MAC in the last 6 bytes, reversed.

Example:

- Manufacturer data bytes: `08 01 e5 a0 52 ab ba d7`
- Last 6 bytes: `e5 a0 52 ab ba d7`
- Reverse to MAC: `D7:BA:AB:52:A0:E5`

Suggested flow:

1. Request device with `optionalManufacturerData: [0xDE98]`.
2. Listen for `advertisementreceived`.
3. If manufacturer data is present, use the reversed last 6 bytes as the hub MAC.
4. If not available (or connect fails), manually enter the hub MAC.

Default gerars:
Gear 1: 1.2
2: 3
3: 4.7
4: 6.9
5: 8.7
6: 11
7: 12.7
8: 14.9
9: 16.7
10: 19
11: 20.7
12: 23.0
Note: specific values come from getPosition
