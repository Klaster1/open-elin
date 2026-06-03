# Zephyr Pod Firmware — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CircuitPython pod emulator (`firmware-pod/code.py`) with a Zephyr RTOS C firmware on SuperMini nRF52840, achieving feature parity with excellent battery life.

**Architecture:** Zephyr RTOS with its built-in BLE stack (no SoftDevice needed). Zephyr's BLE is proven on this exact chip via ZMK keyboards. The application is a BLE peripheral with a custom GATT service matching the NXS BikeNet protocol. The CPU automatically sleeps between BLE events. Protocol frame encoding lives in a standalone C module with host-side unit tests. UF2 flashing via the existing Adafruit bootloader — no debug probe needed.

**Tech Stack:** C (Zephyr RTOS), custom Docker image (Zephyr SDK + source baked in), `west` build system, Zephyr BLE stack, USB CDC for serial logging. Build = `docker run` → produces `.uf2` on host, flashed by copying to bootloader drive.

**Board**: Use upstream Zephyr's `adafruit_feather_nrf52840` board definition (same nRF52840 + same Adafruit bootloader) with a devicetree overlay for SuperMini-specific pins (LED on P0.15 instead of P1.15).

**Key Zephyr config for SuperMini:**
- `CONFIG_CLOCK_CONTROL_NRF_K32SRC_RC=y` — use internal RC oscillator (SuperMini's 32.768 kHz crystal is often faulty)
- `CONFIG_BUILD_OUTPUT_UF2=y` — generate UF2 output
- `CONFIG_USB_DEVICE_STACK=y` — USB CDC serial

**Hardware reference:** [SuperMini NRF52840 wiki (ICBBuy)](http://wiki.icbbuy.com/doku.php?id=developmentboard:nrf52840) · [Feather nRF52840 Zephyr docs](https://docs.zephyrproject.org/latest/boards/adafruit/feather_nrf52840/doc/index.html) · [Alternatives · joric/nrfmicro Wiki](documents/Alternatives · joric_nrfmicro Wiki.htm) (saved locally)

**TDD note:** Protocol frame encoding/decoding (Task 3) is pure C with no Zephyr dependencies, tested on the host via `gcc`. Hardware-dependent tasks (BLE, GPIO, ADC) are verified by flashing and observing behaviour with `npm run cli -- hub monitor`.

---

## File Structure

```
firmware-pod/
├── CMakeLists.txt              # Zephyr application CMake
├── prj.conf                    # Kconfig: BLE, USB, logging, power
├── Dockerfile                  # Bakes Zephyr SDK + source into image
├── build.ps1                   # Docker run → firmware.uf2 on host
├── flash.ps1                   # Copy UF2 to bootloader drive
├── boards/
│   └── adafruit_feather_nrf52840.overlay  # SuperMini pin overrides
├── src/
│   ├── main.c                  # Entry point, BLE advertising, connection loop
│   ├── gatt.h                  # GATT service declarations
│   ├── gatt.c                  # MSG + PIN characteristic definitions
│   ├── protocol.h              # Frame encoding/decoding (no Zephyr deps)
│   ├── protocol.c              # Frame encoding/decoding implementation
│   └── buttons.h / buttons.c   # Serial trigger + GPIO button input
└── tests/
    ├── test_protocol.c          # Host-side unit tests (compiled with gcc)
    └── Makefile                 # Build + run tests on host
```

---

## Task 0: Docker Image + Build Scripts

**Goal:** Build a Docker image with the entire Zephyr SDK + source tree baked in. After that, building firmware is just `docker run` → `firmware.uf2` on the host. No volumes, no `west init` at build time.

**Files:**
- Create: `firmware-pod/Dockerfile`
- Create: `firmware-pod/build.ps1`

- [✅] **Step 1: Create the Dockerfile**

```dockerfile
# firmware-pod/Dockerfile
# Zephyr build environment with SDK + source tree baked in.
# Build once:  docker build -t nxs-zephyr .
# Then build firmware:  docker run --rm -v ./:/app nxs-zephyr

FROM ghcr.io/zephyrproject-rtos/ci:latest

ENV ZEPHYR_SDK_INSTALL_DIR=/opt/toolchains/zephyr-sdk-1.0.1

# Initialize Zephyr workspace (shallow clone — ~2 GB instead of ~8 GB)
WORKDIR /workdir
RUN west init -m https://github.com/zephyrproject-rtos/zephyr --mr main . \
    && west update --narrow -o=--depth=1 \
    && west zephyr-export

# Verify toolchain works
RUN cd zephyr && west build -p always -b adafruit_feather_nrf52840 samples/basic/blinky \
    && rm -rf build

# Default: build the app mounted at /app, copy UF2 to /app/firmware.uf2
WORKDIR /workdir/zephyr
ENTRYPOINT ["bash", "-c", "\
    west build -p auto -b adafruit_feather_nrf52840 /app \
      -- -DOVERLAY_CONFIG=/app/prj.conf \
         -DDTC_OVERLAY_FILE=/app/boards/adafruit_feather_nrf52840.overlay \
    && cp build/zephyr/zephyr.uf2 /app/firmware.uf2 \
    && echo 'OK: firmware.uf2 written' \
"]
```

> **Why bake it in?** The Zephyr source tree + modules are ~2 GB. Baking them into the image means `docker run` is a pure build step — no network, no volume management, no `west init` at build time.

- [✅] **Step 2: Build the Docker image**

One-time step (~10 min, downloads Zephyr + builds verification sample):

```powershell
cd firmware-pod
docker build -t nxs-zephyr .
```

Expected: image builds successfully, blinky sample compiles and is cleaned up.

- [✅] **Step 3: Create `build.ps1` — one-liner wrapper**

```powershell
# firmware-pod/build.ps1
# Build firmware via Docker. Produces firmware.uf2 in this directory.
# Prerequisites: docker build -t nxs-zephyr .

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot

Write-Host "Building firmware..." -ForegroundColor Cyan
docker run --rm -v "${appDir}:/app" nxs-zephyr

if ($LASTEXITCODE -ne 0) { exit 1 }

if (Test-Path "$appDir\firmware.uf2") {
    $size = (Get-Item "$appDir\firmware.uf2").Length / 1KB
    Write-Host "Build complete: firmware.uf2 ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
} else {
    Write-Host "Build failed - no firmware.uf2 produced" -ForegroundColor Red
    exit 1
}
```

- [✅] **Step 4: Create `flash.ps1` — Flash script**

```powershell
# firmware-pod/flash.ps1
# Flash firmware.uf2 to the SuperMini via UF2 bootloader.
# Usage: .\flash.ps1
#   Enter bootloader first: short RST to GND twice.

param([string]$Drive = "")

$ErrorActionPreference = "Stop"

$uf2 = Join-Path $PSScriptRoot "firmware.uf2"
if (-not (Test-Path $uf2)) {
    Write-Host "No firmware.uf2 found. Run .\build.ps1 first." -ForegroundColor Red
    exit 1
}

if (-not $Drive) {
    $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO|FTHR840" } |
                 Select-Object -First 1
    if ($bootDrive) {
        $Drive = "$($bootDrive.DriveLetter):\"
        Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
    } else {
        Write-Host "No bootloader drive found." -ForegroundColor Yellow
        Write-Host "Short RST to GND twice on the SuperMini, then re-run." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Copying firmware.uf2 to $Drive ..." -ForegroundColor Cyan
Copy-Item $uf2 $Drive
Write-Host "Done! Board will reboot into new firmware." -ForegroundColor Green
```

---

## Task 1: Blink LED

**Goal:** Build and flash a minimal Zephyr app that blinks the SuperMini's LED (P0.15). Proves the full toolchain → UF2 → hardware pipeline works.

**Files:**
- Create: `firmware-pod/CMakeLists.txt`
- Create: `firmware-pod/prj.conf`
- Create: `firmware-pod/boards/adafruit_feather_nrf52840.overlay`
- Create: `firmware-pod/src/main.c`

- [✅] **Step 1: Create `CMakeLists.txt`**

```cmake
# firmware-pod/CMakeLists.txt
cmake_minimum_required(VERSION 3.20.0)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(nxs-pod-firmware)

target_sources(app PRIVATE
  src/main.c
)
```

- [✅] **Step 2: Create `prj.conf`**

```ini
# firmware-pod/prj.conf

# Use internal RC oscillator (SuperMini's 32.768 kHz crystal is often faulty)
CONFIG_CLOCK_CONTROL_NRF_K32SRC_RC=y
CONFIG_CLOCK_CONTROL_NRF_K32SRC_XTAL=n

# Generate UF2 output for Adafruit bootloader flashing
CONFIG_BUILD_OUTPUT_UF2=y

# Logging
CONFIG_LOG=y
CONFIG_LOG_DEFAULT_LEVEL=3

# GPIO
CONFIG_GPIO=y
```

- [✅] **Step 3: Create devicetree overlay for SuperMini**

The Feather has LED0 on P1.15. SuperMini has it on P0.15 (active HIGH).

```dts
/* firmware-pod/boards/adafruit_feather_nrf52840.overlay */
/* SuperMini nRF52840 pin overrides */

/ {
    leds {
        compatible = "gpio-leds";
        led0: led_0 {
            gpios = <&gpio0 15 GPIO_ACTIVE_HIGH>;
            label = "Red LED";  /* SuperMini swaps colors: "red" is actually the user LED */
        };
    };
};
```

- [✅] **Step 4: Create minimal `main.c` — blink LED**

```c
/* firmware-pod/src/main.c */
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

int main(void)
{
    gpio_pin_configure_dt(&led, GPIO_OUTPUT_ACTIVE);

    while (1) {
        gpio_pin_set_dt(&led, 1);
        k_msleep(200);
        gpio_pin_set_dt(&led, 0);
        k_msleep(800);
    }
    return 0;
}
```

- [✅] **Step 5: Build**

```powershell
cd firmware-pod
.\build.ps1
```

Expected: `firmware.uf2` created successfully.

- [✅] **Step 6: Flash and verify**

Enter bootloader (short RST to GND twice), then:

```powershell
.\flash.ps1
```

Expected: LED on P0.15 blinks (200ms on, 800ms off). If LED doesn't blink, check polarity — try `GPIO_ACTIVE_LOW` in the overlay.

- [ ] **Step 7: Commit**

```powershell
git add firmware-pod/
git commit -m "feat(firmware-c): zephyr project skeleton + LED blink (UF2)"
```

---

## Task 2: USB Serial Logging

**Goal:** Add USB CDC serial output so `printk()` and `LOG_INF()` appear on the PC's serial terminal. This is the `console.log()` for the firmware.

**Files:**
- Modify: `firmware-pod/prj.conf`
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add USB + console config to prj.conf**

Append to `prj.conf`:

```ini
# USB CDC ACM serial console
CONFIG_USB_DEVICE_STACK=y
CONFIG_USB_DEVICE_PRODUCT="NXS Pod Firmware"
CONFIG_USB_DEVICE_VID=0x1209
CONFIG_USB_DEVICE_PID=0x0001
CONFIG_UART_LINE_CTRL=y

# Route console and logging to USB serial
CONFIG_CONSOLE=y
CONFIG_UART_CONSOLE=y
CONFIG_SERIAL=y
CONFIG_USB_CDC_ACM=y
CONFIG_USB_CDC_ACM_LOG_LEVEL_OFF=y
```

- [✅] **Step 2: Update main.c with USB init and logging**

Replace `main.c`:

```c
/* firmware-pod/src/main.c */
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/usb/usb_device.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

int main(void)
{
    /* Enable USB subsystem */
    usb_enable(NULL);
    /* Give host time to enumerate the USB CDC device */
    k_msleep(1000);

    gpio_pin_configure_dt(&led, GPIO_OUTPUT_ACTIVE);

    LOG_INF("NXS pod firmware v0.1.0");
    LOG_INF("chip: nRF52840  board: SuperMini");

    int count = 0;
    while (1) {
        gpio_pin_set_dt(&led, 1);
        k_msleep(200);
        gpio_pin_set_dt(&led, 0);
        k_msleep(800);
        count++;
        LOG_INF("blink #%d", count);
    }
    return 0;
}
```

- [✅] **Step 3: Build and flash**

```powershell
.\build.ps1
# Enter bootloader (RST-GND double-short)
.\flash.ps1
```

- [✅] **Step 4: Verify USB serial output**

Open a serial terminal (PuTTY, `mode COM<N>`, or VS Code Serial Monitor) on the new COM port. Expected output:

```
[00:00:01.000,000] <inf> main: NXS pod firmware v0.1.0
[00:00:01.000,000] <inf> main: chip: nRF52840  board: SuperMini
[00:00:02.000,000] <inf> main: blink #1
[00:00:03.000,000] <inf> main: blink #2
```

If no COM port appears, check that the USB cable supports data (not charge-only).

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(firmware-c): USB CDC serial logging"
```

---

## Task 3: Protocol Frame Encoding (TDD)

**Goal:** Implement button notification, battery notification, and ShiftComplete parsing as standalone C functions. Test on the host with `gcc` — no Zephyr or hardware needed.

**Files:**
- Create: `firmware-pod/src/protocol.h`
- Create: `firmware-pod/src/protocol.c`
- Create: `firmware-pod/tests/test_protocol.c`
- Create: `firmware-pod/tests/Makefile`
- Modify: `firmware-pod/CMakeLists.txt` (add protocol.c to sources)

- [✅] **Step 1: Write the test file**

```c
/* firmware-pod/tests/test_protocol.c */
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "../src/protocol.h"

static const uint8_t FAKE_MAC[MAC_LEN] = {0x43, 0xB5, 0x0B, 0x23, 0x4F, 0xC2};

static void test_button_press_encoding(void)
{
    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, FAKE_MAC, 0x01, ACTION_PRESS);
    assert(get_le16(&frame[OFF_OPCODE]) == OPCODE_BUTTON);
    assert(memcmp(&frame[OFF_MAC], FAKE_MAC, MAC_LEN) == 0);
    assert(frame[OFF_PAYLOAD] == 0x01);       /* button id */
    assert(frame[OFF_PAYLOAD + 1] == ACTION_PRESS);
    printf("  PASS: test_button_press_encoding\n");
}

static void test_button_release_encoding(void)
{
    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, FAKE_MAC, 0x00, ACTION_RELEASE);
    assert(get_le16(&frame[OFF_OPCODE]) == OPCODE_BUTTON);
    assert(frame[OFF_PAYLOAD + 1] == ACTION_RELEASE);
    printf("  PASS: test_button_release_encoding\n");
}

static void test_battery_encoding(void)
{
    uint8_t frame[FRAME_LEN];
    protocol_encode_battery(frame, FAKE_MAC, 3000);
    assert(get_le16(&frame[OFF_OPCODE]) == OPCODE_BATTERY);
    assert(memcmp(&frame[OFF_MAC], FAKE_MAC, MAC_LEN) == 0);
    assert(get_le16(&frame[OFF_PAYLOAD]) == 3000);
    printf("  PASS: test_battery_encoding\n");
}

static void test_shift_complete_parse(void)
{
    uint8_t data[SHIFT_COMPLETE_LEN] = {0};
    put_le16(&data[OFF_OPCODE], OPCODE_SHIFT_COMPLETE);
    data[OFF_SC_GEAR] = 7;

    struct shift_complete result;
    assert(protocol_parse_shift_complete(data, sizeof(data), &result) == 0);
    assert(result.gear == 7);
    printf("  PASS: test_shift_complete_parse\n");
}

static void test_shift_complete_wrong_opcode(void)
{
    uint8_t data[SHIFT_COMPLETE_LEN] = {0};
    put_le16(&data[OFF_OPCODE], OPCODE_BUTTON);  /* wrong opcode */
    data[OFF_SC_GEAR] = 5;

    struct shift_complete result;
    assert(protocol_parse_shift_complete(data, sizeof(data), &result) != 0);
    printf("  PASS: test_shift_complete_wrong_opcode\n");
}

static void test_shift_complete_too_short(void)
{
    uint8_t data[FRAME_LEN] = {0};  /* 10 bytes, need 11 */
    put_le16(&data[OFF_OPCODE], OPCODE_SHIFT_COMPLETE);

    struct shift_complete result;
    assert(protocol_parse_shift_complete(data, sizeof(data), &result) != 0);
    printf("  PASS: test_shift_complete_too_short\n");
}

int main(void)
{
    printf("Running protocol tests...\n");
    test_button_press_encoding();
    test_button_release_encoding();
    test_battery_encoding();
    test_shift_complete_parse();
    test_shift_complete_wrong_opcode();
    test_shift_complete_too_short();
    printf("All 6 tests passed.\n");
    return 0;
}
```

- [✅] **Step 2: Write the header**

```c
/* firmware-pod/src/protocol.h */
#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <stdint.h>
#include <stddef.h>

/*── Opcodes (little-endian on the wire) ──*/
#define OPCODE_BATTERY        0x4000
#define OPCODE_BUTTON         0x4001
#define OPCODE_SHIFT_COMPLETE 0x4003

/*── Button actions ──*/
#define ACTION_PRESS   0x00
#define ACTION_RELEASE 0x01

/*── Common frame layout: [opcode 2B LE][mac 6B LE][payload 2B] ──*/
#define FRAME_LEN       10
#define MAC_LEN          6

enum frame_offsets {
    OFF_OPCODE  = 0,   /* 2 bytes, little-endian */
    OFF_MAC     = 2,   /* 6 bytes, little-endian */
    OFF_PAYLOAD = 8,   /* 2 bytes — meaning depends on opcode */
};

/*── ShiftComplete is longer: 11 bytes, gear at byte 10 ──*/
#define SHIFT_COMPLETE_LEN  11
#define OFF_SC_GEAR         10

/*── LE16 wire helpers ──*/
static inline void put_le16(uint8_t *dst, uint16_t val)
{
    dst[0] = (uint8_t)(val & 0xFF);
    dst[1] = (uint8_t)(val >> 8);
}

static inline uint16_t get_le16(const uint8_t *src)
{
    return (uint16_t)src[0] | ((uint16_t)src[1] << 8);
}

/*── Parsed result types ──*/
struct shift_complete {
    uint8_t gear;
};

/*── Encoding ──*/
void protocol_encode_button(uint8_t out[FRAME_LEN],
                            const uint8_t mac_le[MAC_LEN],
                            uint8_t button_id, uint8_t action);

void protocol_encode_battery(uint8_t out[FRAME_LEN],
                             const uint8_t mac_le[MAC_LEN],
                             uint16_t mv);

/*── Parsing — returns 0 on success, -1 on invalid frame ──*/
int protocol_parse_shift_complete(const uint8_t *data, size_t len,
                                  struct shift_complete *out);

#endif /* PROTOCOL_H */
```

- [✅] **Step 3: Write the Makefile for host tests**

```makefile
# firmware-pod/tests/Makefile
CC = gcc
CFLAGS = -Wall -Wextra -std=c11

test: test_protocol
	./test_protocol

test_protocol: test_protocol.c ../src/protocol.c ../src/protocol.h
	$(CC) $(CFLAGS) -I../src -o $@ test_protocol.c ../src/protocol.c

clean:
	rm -f test_protocol

.PHONY: test clean
```

- [✅] **Step 4: Run tests — verify they fail (won't compile, protocol.c doesn't exist)**

```powershell
cd firmware-pod/tests
make test
```

Expected: compilation fails — `protocol.c` doesn't exist yet.

- [✅] **Step 5: Implement protocol.c**

```c
/* firmware-pod/src/protocol.c */
#include "protocol.h"
#include <string.h>

void protocol_encode_button(uint8_t out[FRAME_LEN],
                            const uint8_t mac_le[MAC_LEN],
                            uint8_t button_id, uint8_t action)
{
    put_le16(&out[OFF_OPCODE], OPCODE_BUTTON);
    memcpy(&out[OFF_MAC], mac_le, MAC_LEN);
    out[OFF_PAYLOAD]     = button_id;
    out[OFF_PAYLOAD + 1] = action;
}

void protocol_encode_battery(uint8_t out[FRAME_LEN],
                             const uint8_t mac_le[MAC_LEN],
                             uint16_t mv)
{
    put_le16(&out[OFF_OPCODE], OPCODE_BATTERY);
    memcpy(&out[OFF_MAC], mac_le, MAC_LEN);
    put_le16(&out[OFF_PAYLOAD], mv);
}

int protocol_parse_shift_complete(const uint8_t *data, size_t len,
                                  struct shift_complete *out)
{
    if (len < SHIFT_COMPLETE_LEN) {
        return -1;
    }
    if (get_le16(&data[OFF_OPCODE]) != OPCODE_SHIFT_COMPLETE) {
        return -1;
    }
    out->gear = data[OFF_SC_GEAR];
    return 0;
}
```

- [✅] **Step 6: Run tests — verify all pass**

```powershell
cd firmware-pod/tests
make test
```

Expected:
```
Running protocol tests...
  PASS: test_button_press_encoding
  PASS: test_button_release_encoding
  PASS: test_battery_encoding
  PASS: test_shift_complete_parse
  PASS: test_shift_complete_wrong_opcode
  PASS: test_shift_complete_too_short
All 6 tests passed.
```

- [✅] **Step 7: Add protocol.c to CMakeLists.txt**

```cmake
target_sources(app PRIVATE
  src/main.c
  src/protocol.c
)
```

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat(firmware-c): protocol frame encoding with host tests"
```

---

## Task 4: BLE Advertising

**Goal:** Advertise as "NXS MTB Pod" with manufacturer data matching the real pod. Verify with `nRF Connect` app or `npm run cli -- ble scan`.

**Files:**
- Modify: `firmware-pod/prj.conf`
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add BLE config to prj.conf**

Append to `prj.conf`:

```ini
# BLE
CONFIG_BT=y
CONFIG_BT_PERIPHERAL=y
CONFIG_BT_DEVICE_NAME="NXS MTB Pod"
CONFIG_BT_DEVICE_APPEARANCE=0
CONFIG_BT_GAP_AUTO_UPDATE_CONN_PARAMS=y

# Increase max connections if needed (default is fine for 1 hub)
CONFIG_BT_MAX_CONN=1
```

- [✅] **Step 2: Update main.c with BLE advertising**

Replace `main.c`:

```c
/* firmware-pod/src/main.c */
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/usb/usb_device.h>
#include <zephyr/logging/log.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/gap.h>

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

/* BikeNet service UUID: a5c1c000-cc20-ba91-0c1a-ef3f9e643d79 (128-bit, LE) */
static const uint8_t svc_uuid_le[16] = {
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5,
};

/* Manufacturer specific data: company 0xDE98, device bytes, own MAC, trailing 0x00 */
static uint8_t mfr_data[12]; /* filled at runtime with own MAC */

static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
    BT_DATA(BT_DATA_MANUFACTURER_DATA, mfr_data, sizeof(mfr_data)),
    BT_DATA(BT_DATA_NAME_COMPLETE, "NXS MTB Pod", 11),
};

static const struct bt_data sd[] = {
    BT_DATA(BT_DATA_UUID128_ALL, svc_uuid_le, sizeof(svc_uuid_le)),
};

static void fill_mfr_data(void)
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);

    mfr_data[0] = 0x98;  /* company ID 0xDE98 LE */
    mfr_data[1] = 0xDE;
    mfr_data[2] = 0x0A;  /* device type bytes */
    mfr_data[3] = 0x10;
    memcpy(&mfr_data[4], addr.a.val, 6);  /* own MAC LE */
    mfr_data[10] = 0x00;
    /* mfr_data[11] stays 0 — padding to match real pod */
}

static void start_advertising(void)
{
    int err = bt_le_adv_start(BT_LE_ADV_CONN, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
    if (err) {
        LOG_ERR("Advertising failed to start (err %d)", err);
    } else {
        LOG_INF("Advertising as 'NXS MTB Pod'");
    }
}

static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("Connection failed (err %u)", err);
        return;
    }
    LOG_INF("HUB CONNECTED");
    gpio_pin_set_dt(&led, 1);
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    LOG_INF("HUB DISCONNECTED (reason %u)", reason);
    gpio_pin_set_dt(&led, 0);
    start_advertising();
}

BT_CONN_CB_DEFINE(conn_callbacks) = {
    .connected = connected,
    .disconnected = disconnected,
};

int main(void)
{
    usb_enable(NULL);
    k_msleep(1000);

    gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE);

    LOG_INF("NXS pod firmware v0.1.0 (Zephyr)");

    int err = bt_enable(NULL);
    if (err) {
        LOG_ERR("Bluetooth init failed (err %d)", err);
        return 1;
    }

    fill_mfr_data();
    start_advertising();

    /* Main loop — nothing to do, BLE stack runs in Zephyr threads */
    while (1) {
        k_sleep(K_FOREVER);
    }
    return 0;
}
```

- [✅] **Step 3: Build and flash**

```powershell
.\build.ps1
# Enter bootloader
.\flash.ps1
```

- [✅] **Step 4: Verify advertisement**

From a phone (nRF Connect app) or the CLI:

```powershell
npm run cli -- ble scan
```

Expected: "NXS MTB Pod" appears in scan results with the correct manufacturer data.

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(firmware-c): BLE advertising as NXS MTB Pod"
```

---

## Task 5: GATT Service — MSG + PIN Characteristics

**Goal:** Register the BikeNet GATT service with MSG (a5c1cc01) and PIN (a5c1cc02) characteristics. Both support write + notify.

**Files:**
- Create: `firmware-pod/src/gatt.h`
- Create: `firmware-pod/src/gatt.c`
- Modify: `firmware-pod/CMakeLists.txt`
- Modify: `firmware-pod/prj.conf`
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add GATT config to prj.conf**

Append to `prj.conf`:

```ini
# GATT
CONFIG_BT_GATT_DYNAMIC_DB=n
CONFIG_BT_ATT_TX_COUNT=4
```

- [✅] **Step 2: Create gatt.h**

```c
/* firmware-pod/src/gatt.h */
#ifndef GATT_H
#define GATT_H

#include <zephyr/bluetooth/gatt.h>

/**
 * Send a notification on the MSG characteristic.
 * @param data  Pointer to the frame bytes
 * @param len   Length of the frame (typically 10)
 * @return 0 on success, negative errno on failure
 */
int gatt_notify_msg(const uint8_t *data, size_t len);

/**
 * Callback type for incoming writes on MSG or PIN.
 * Registered via gatt_set_msg_write_cb / gatt_set_pin_write_cb.
 */
typedef void (*gatt_write_cb_t)(const uint8_t *data, uint16_t len);

void gatt_set_msg_write_cb(gatt_write_cb_t cb);
void gatt_set_pin_write_cb(gatt_write_cb_t cb);

#endif /* GATT_H */
```

- [✅] **Step 3: Create gatt.c**

```c
/* firmware-pod/src/gatt.c */
#include "gatt.h"
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/logging/log.h>
#include <string.h>

LOG_MODULE_REGISTER(gatt, LOG_LEVEL_INF);

/* BikeNet service UUID: a5c1c000-cc20-ba91-0c1a-ef3f9e643d79 */
static struct bt_uuid_128 svc_uuid = BT_UUID_INIT_128(
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5);

/* MSG characteristic UUID: a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79 */
static struct bt_uuid_128 msg_uuid = BT_UUID_INIT_128(
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x01, 0xCC, 0xC1, 0xA5);

/* PIN characteristic UUID: a5c1cc02-cc20-ba91-0c1a-ef3f9e643d79 */
static struct bt_uuid_128 pin_uuid = BT_UUID_INIT_128(
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x02, 0xCC, 0xC1, 0xA5);

static gatt_write_cb_t msg_write_cb;
static gatt_write_cb_t pin_write_cb;

static uint8_t msg_buf[20];
static uint8_t pin_buf[20];

void gatt_set_msg_write_cb(gatt_write_cb_t cb) { msg_write_cb = cb; }
void gatt_set_pin_write_cb(gatt_write_cb_t cb) { pin_write_cb = cb; }

static ssize_t msg_write(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                         const void *buf, uint16_t len, uint16_t offset, uint8_t flags)
{
    if (offset + len > sizeof(msg_buf)) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }
    memcpy(msg_buf + offset, buf, len);
    LOG_HEXDUMP_INF(msg_buf, len, "<- MSG");
    if (msg_write_cb) {
        msg_write_cb(msg_buf, len);
    }
    return len;
}

static ssize_t pin_write(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                         const void *buf, uint16_t len, uint16_t offset, uint8_t flags)
{
    if (offset + len > sizeof(pin_buf)) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }
    memcpy(pin_buf + offset, buf, len);
    LOG_HEXDUMP_INF(pin_buf, len, "<- PIN");
    if (pin_write_cb) {
        pin_write_cb(pin_buf, len);
    }
    return len;
}

/* CCC changed callbacks for MSG (notifications) */
static void msg_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
    LOG_INF("MSG notifications %s", value == BT_GATT_CCC_NOTIFY ? "enabled" : "disabled");
}

BT_GATT_SERVICE_DEFINE(bikenet_svc,
    BT_GATT_PRIMARY_SERVICE(&svc_uuid),

    /* MSG characteristic: write + write_no_resp + notify */
    BT_GATT_CHARACTERISTIC(&msg_uuid.uuid,
        BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP | BT_GATT_CHRC_NOTIFY,
        BT_GATT_PERM_WRITE,
        NULL, msg_write, NULL),
    BT_GATT_CCC(msg_ccc_changed, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),

    /* PIN characteristic: write + write_no_resp + notify */
    BT_GATT_CHARACTERISTIC(&pin_uuid.uuid,
        BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP | BT_GATT_CHRC_NOTIFY,
        BT_GATT_PERM_WRITE,
        NULL, pin_write, NULL),
    BT_GATT_CCC(NULL, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),
);

int gatt_notify_msg(const uint8_t *data, size_t len)
{
    return bt_gatt_notify(NULL, &bikenet_svc.attrs[1], data, len);
}
```

- [✅] **Step 4: Add gatt.c to CMakeLists.txt**

```cmake
target_sources(app PRIVATE
  src/main.c
  src/protocol.c
  src/gatt.c
)
```

- [✅] **Step 5: Update main.c — add PIN exchange handler**

Add after the `#include` lines in `main.c`:

```c
#include "gatt.h"
#include "protocol.h"
```

Add a PIN write handler and register it in `main()` before `start_advertising()`:

```c
static void on_pin_write(const uint8_t *data, uint16_t len)
{
    LOG_INF("PIN exchange received (%u bytes) -> ACK 0x01", len);
    /* Respond with 0x01 (acknowledged) */
    static const uint8_t ack = 0x01;
    bt_gatt_notify(NULL, &bikenet_svc.attrs[5], &ack, 1);
}

/* In main(), before start_advertising(): */
    gatt_set_pin_write_cb(on_pin_write);
```

> **Note:** The attr index for PIN CCC may need adjustment depending on how BT_GATT_SERVICE_DEFINE lays out attributes. Check at runtime with logging if PIN notifications don't work.

- [✅] **Step 6: Build, flash, and verify**

```powershell
.\build.ps1
.\flash.ps1
```

Verified via direct BLE connection from PC. PIN exchange: wrote 4 bytes → received ACK `0x01` notification. MSG notifications received (battery + button events).

- [ ] **Step 7: Commit**

```powershell
git commit -am "feat(firmware-c): GATT service with MSG + PIN characteristics"
```

---

## Task 6: Button Input — Serial Trigger (+ GPIO Reserved)

**Goal:** Accept button commands via USB serial ('u' = shift up, 'd' = shift down) and send button press/release notifications to the hub via the MSG characteristic.

**Files:**
- Modify: `firmware-pod/src/main.c`
- Modify: `firmware-pod/prj.conf`

- [✅] **Step 1: Add UART polling config to prj.conf**

Already have `CONFIG_SERIAL=y` and `CONFIG_UART_CONSOLE=y`. Add:

```ini
# Shell / serial input (for button triggers)
CONFIG_UART_INTERRUPT_DRIVEN=y
```

- [✅] **Step 2: Add serial input handling + button notifications to main.c**

Add to `main.c` after existing includes:

```c
#include <zephyr/drivers/uart.h>

#define BTN_SHIFT_UP   0x00
#define BTN_SHIFT_DOWN 0x01
#define BATTERY_MV     3000

static void get_own_mac(uint8_t mac_le[MAC_LEN])
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);
    memcpy(mac_le, addr.a.val, 6);
}

static void send_press_release(uint8_t btn_id)
{
    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, mac, btn_id, ACTION_PRESS);
    gatt_notify_msg(frame, sizeof(frame));
    k_msleep(50);
    protocol_encode_button(frame, mac, btn_id, ACTION_RELEASE);
    gatt_notify_msg(frame, sizeof(frame));

    LOG_INF("-> button 0x%02X press+release", btn_id);
}

static void send_battery(void)
{
    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_battery(frame, mac, BATTERY_MV);
    gatt_notify_msg(frame, sizeof(frame));
    LOG_INF("-> battery %d mV", BATTERY_MV);
}
```

Replace the main loop (`while (1) { k_sleep(K_FOREVER); }`) with:

```c
    const struct device *console = DEVICE_DT_GET(DT_CHOSEN(zephyr_console));
    uint8_t ch;
    int64_t last_battery = 0;

    while (1) {
        /* Poll for serial input */
        if (uart_poll_in(console, &ch) == 0) {
            if (ch == 'u' || ch == 'b') {
                send_press_release(BTN_SHIFT_UP);
            } else if (ch == 'd') {
                send_press_release(BTN_SHIFT_DOWN);
            }
        }

        /* Periodic battery report every 5 seconds */
        int64_t now = k_uptime_get();
        if (now - last_battery >= 5000) {
            last_battery = now;
            send_battery();
        }

        k_msleep(20);
    }
```

- [✅] **Step 3: Build, flash, and verify**

Verified via direct BLE connection: serial `u` → BTN 0x00 PRESS+RELEASE, serial `d` → BTN 0x01 PRESS+RELEASE. Battery reports every 5s.

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(firmware-c): serial button triggers + battery reporting"
```

---

## Task 7: MSG Write Handling — ShiftComplete

**Goal:** Parse incoming MSG writes from the hub. If a ShiftComplete (0x4003) is received, log the gear number.

**Files:**
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add MSG write callback**

In `main.c`, add:

```c
static void on_msg_write(const uint8_t *data, uint16_t len)
{
    struct shift_complete sc;
    if (protocol_parse_shift_complete(data, len, &sc) == 0) {
        LOG_INF("ShiftComplete: gear=%u", sc.gear);
    }
}
```

Register it in `main()` alongside the PIN callback:

```c
    gatt_set_msg_write_cb(on_msg_write);
```

- [✅] **Step 2: Build, flash, and verify**

Verified: wrote ShiftComplete frame `03 40 E5 A0 52 AB BA D7 00 00 07` to MSG → serial log shows `ShiftComplete: gear=7`.

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(firmware-c): ShiftComplete parsing from hub MSG writes"
```

---

## Task 8: Bootloader Entry via Serial

**Goal:** Send 'B' over serial to reboot into the UF2 bootloader. Enables reflashing without physically touching the board.

**Files:**
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add bootloader entry to serial handler**

Add to `main.c`:

```c
#include <zephyr/sys/reboot.h>

static void enter_bootloader(void)
{
    /* Write magic 0x57 to GPREGRET — Adafruit bootloader stays in DFU mode */
    NRF_POWER->GPREGRET = 0x57;
    sys_reboot(SYS_REBOOT_COLD);
}
```

In the serial input handler, add:

```c
            } else if (ch == 'B') {
                LOG_INF("Entering bootloader...");
                k_msleep(100);  /* flush log */
                enter_bootloader();
            }
```

- [✅] **Step 2: Add NRF_POWER register access**

Ensure `nrf.h` is included at the top of `main.c`:

```c
#include <hal/nrf_power.h>
```

If this doesn't work, use the raw register address:

```c
#define NRF_POWER_GPREGRET ((volatile uint32_t *)0x4000051C)
*NRF_POWER_GPREGRET = 0x57;
```

- [✅] **Step 3: Build, flash, and verify**

Send 'B' over serial. The board should reboot into bootloader mode (USB drive appears).

- [✅] **Step 4: Update flash.ps1 to support serial bootloader entry**

Add to `flash.ps1`, before the drive detection:

```powershell
# Try to enter bootloader via serial
$port = [System.IO.Ports.SerialPort]::GetPortNames() | Select-Object -First 1
if ($port -and -not $Drive) {
    Write-Host "Sending bootloader command to $port..." -ForegroundColor Cyan
    try {
        $serial = New-Object System.IO.Ports.SerialPort $port, 115200
        $serial.Open()
        $serial.Write("B")
        $serial.Close()
        Start-Sleep -Seconds 3  # Wait for reboot into bootloader
    } catch {
        Write-Host "Serial send failed: $_" -ForegroundColor Yellow
    }
}
```

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(firmware-c): bootloader entry via serial command"
```

---

## Task 9: Power Optimisation

**Goal:** Reduce power consumption to maximize battery life. Zephyr handles most of this automatically, but there are a few explicit tweaks.

**Files:**
- Modify: `firmware-pod/prj.conf`
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add power config to prj.conf**

```ini
# Power management
CONFIG_PM=y
CONFIG_PM_DEVICE=y

# Disable unused features
CONFIG_SERIAL=y
CONFIG_GPIO=y
# These are already minimal, but ensure no debug features leak power
CONFIG_LOG_DEFAULT_LEVEL=2
```

- [✅] **Step 2: Replace polling loop with event-driven sleep**

Replace the `while (1) { ... k_msleep(20); }` main loop with a more power-efficient approach using a k_timer for battery reporting and UART callback for serial input:

```c
static struct k_timer battery_timer;

static void battery_timer_handler(struct k_timer *timer)
{
    send_battery();
}

/* In main(), replace the while loop: */
    k_timer_init(&battery_timer, battery_timer_handler, NULL);
    k_timer_start(&battery_timer, K_SECONDS(5), K_SECONDS(5));

    /* Serial input still needs polling since USB CDC may not support interrupt-driven rx.
       But use longer sleep to save power. When GPIO buttons are wired, this loop
       can be replaced entirely with GPIO callbacks. */
    while (1) {
        if (uart_poll_in(console, &ch) == 0) {
            if (ch == 'u' || ch == 'b') {
                send_press_release(BTN_SHIFT_UP);
            } else if (ch == 'd') {
                send_press_release(BTN_SHIFT_DOWN);
            } else if (ch == 'B') {
                LOG_INF("Entering bootloader...");
                k_msleep(100);
                enter_bootloader();
            }
        }
        k_msleep(50);  /* longer sleep than 20ms — still responsive, less CPU wake */
    }
```

- [✅] **Step 3: Build, flash, and verify**

Verified: BLE advertising, connection, battery timer (5s interval), and button triggers all working with CONFIG_PM=y and reduced log level.

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(firmware-c): power optimisation + event-driven battery timer"
```

---

## Summary

| Task | Description | Test method |
|------|-------------|-------------|
| 0 | Docker + Zephyr workspace | `west build` succeeds |
| 1 | Blink LED | Visual: LED blinks on board |
| 2 | USB serial logging | Serial terminal shows log output |
| 3 | Protocol encoding (TDD) | `make test` — 6 host tests pass |
| 4 | BLE advertising | nRF Connect / `ble scan` shows "NXS MTB Pod" |
| 5 | GATT service | Hub connects, PIN exchange works |
| 6 | Button input | Serial 'u'/'d' triggers shifts on hub |
| 7 | ShiftComplete | Hub MSG writes parsed and logged |
| 8 | Bootloader entry | Serial 'B' reboots to UF2 |
| 9 | Power optimisation | Same functionality, longer battery life |
