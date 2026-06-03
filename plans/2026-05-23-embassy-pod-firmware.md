# Embassy Pod Firmware — Implementation Plan

## ⛔ STATUS: BLOCKED — Embassy Timer crashes on SuperMini nRF52840

**Date:** 2026-05-23
**Stopped at:** Task 1 (USB Serial Logging) — Tasks 2–3 (protocol TDD) completed independently.

### What was completed
- **Task 0 (Blink):** DONE — LED blinks using a poll-based `delay_ms()` workaround (NOT Embassy Timer)
- **Task 2 (Protocol Encoding TDD):** DONE — `encode_button()`, `encode_battery()` with 3 passing tests
- **Task 3 (ShiftComplete Parsing TDD):** DONE — `parse_shift_complete()` with 3 passing tests (6 total via `cargo test`)
- **Task 1 (USB Serial):** BLOCKED — compiled and flashed, but crashes on hardware (3 diagnostic blinks then silence)

### The Timer bug
Embassy's `Timer::after_millis()` panics on the **second** `.await` call. Confirmed on:
- Embassy git main (all deps from `https://github.com/embassy-rs/embassy.git`)
- Embassy crates.io stable (executor 0.10.0, time 0.5.1, nrf 0.10.0)

**Symptoms:** First `Timer::after_millis().await` works. Second one triggers the panic handler (solid LED = panic, not HardFault). This is not a user code issue — it's inside Embassy's timer queue/alarm machinery.

**Impact:** Timer is used internally by Embassy's USB and BLE drivers. The poll-based `delay_ms()` workaround only fixes user-level delays — it can't patch Timer usage inside `embassy-usb`, `embassy-nrf`, or `trouble`. This means **all Embassy drivers that depend on Timer are broken on this board**, blocking Tasks 1, 4–11.

### What was ruled out
- RefCell borrow panic
- USB-specific code (Timer crashes even in a minimal blink-only firmware)
- Bootloader leftover state (`pre_init` clears RTC0, RTC1, LFCLK, NVIC)
- Watchdog
- LFCLK source (tried InternalRC explicitly)
- Vector table corruption
- Stack overflow
- Executor configuration
- `.data` section initialization
- Optimization level
- Generic timer queue vs default
- Flash address (tested both 0x1000 and 0x26000 origins)
- Git main vs crates.io stable releases

### What might fix it (not yet tried)
1. **SWD debug probe** — connect WCH-Link to SuperMini SWD pads, get a real stack trace on the panic. Would reveal the exact line in Embassy's timer queue code. Requires designing an SWD-to-pads adapter (current one has wrong pitch).
2. **Different nRF52840 board** — test on a board with an external 32.768 kHz crystal (SuperMini uses InternalRC for LFCLK). Could be an RC oscillator timing issue.
3. **Patch Embassy's RTC1 time driver** — add debug output to the alarm setup code to see what's failing.

### Hardware details
- **Board:** SuperMini nRF52840 (Nice!Nano clone), no HFXO crystal, InternalRC for LFCLK
- **LED:** P0.15, active HIGH
- **Bootloader:** Adafruit nRF52 UF2 bootloader
- **UF2 params:** `--base 0x1000 --family 0x239A00B3`
- **Memory layout:** FLASH ORIGIN=0x1000 LENGTH=972K, RAM ORIGIN=0x20000000 LENGTH=256K
- **Build:** `cargo build --release` → `cargo objcopy --release -- -O binary firmware.bin` → `uf2conv firmware.bin --base 0x1000 --family 0x239A00B3 --output firmware.uf2`

### Current state of code
- `Cargo.toml` — crates.io deps, USB deps commented out
- `main.rs` — minimal Timer test firmware (panics on 2nd Timer await)
- `protocol.rs` — complete, 6 host tests passing
- `memory.x`, `build.rs`, `.cargo/config.toml` — working

### Decision
Plan is **shelved**. CircuitPython prototype remains the active pod firmware. Rust port can resume if:
- Timer bug is diagnosed via SWD probe, or
- A different board is available, or
- Embassy fixes the underlying issue upstream

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CircuitPython pod emulator (`firmware-pod/code.py`) with Rust firmware on SuperMini nRF52840, achieving feature parity with good battery life.

**Architecture:** Embassy async runtime + `trouble` (pure Rust BLE host stack) for BLE. The BLE controller layer uses Nordic's SoftDevice Controller (`nrf-sdc`) — a static library that gets linked into the application binary (NOT the full SoftDevice that occupies a fixed flash region). This means the existing UF2 bootloader is preserved and flashing is via USB drag-and-drop, exactly like CircuitPython. Embassy's async model maps perfectly to "sleep until event" — the CPU automatically enters low-power mode between `await` points. Protocol frame encoding lives in a separate module with host-side unit tests (TDD). Everything else is verified by flashing and observing behaviour with `hub monitor`.

**Tech Stack:** Rust (nightly — required by Embassy), `embassy-executor`, `embassy-nrf`, `embassy-time`, `embassy-sync`, `trouble` (pure Rust BLE host), `nrf-sdc` (Nordic BLE controller, linked into binary), `embassy-usb` for USB serial logging, `log` crate.

**Flashing:** UF2 via USB — `flash.ps1` sends `b` over serial to trigger bootloader entry, then copies the `.uf2` file to the USB drive. Fully automated after Task 1 (no touching the board). No debug probe needed. No SoftDevice blob to flash separately.

**Hardware reference:** [SuperMini NRF52840 wiki (ICBBuy)](http://wiki.icbbuy.com/doku.php?id=developmentboard:nrf52840) · [nrfmicro wiki — SuperMini section](https://github.com/joric/nrfmicro/wiki/Alternatives#supermini-nrf52840)

> **⚠️ SuperMini has no reset button.** The board has no tactile switches. To enter the UF2 bootloader, **short the RST pad to GND twice within 0.5 seconds** using tweezers, a wire, or a paperclip. The RST and GND pads are on the board edge (see pinout diagram in the wiki links above). Alternatively, while CircuitPython is still running, you can enter the bootloader from code without touching any pads — see the "First-time bootloader entry" note in the Flash Workflow section.

**Scope:** Personal use. No DFU/OTA. Three buttons (–, A-1, A-2) triggered via USB serial (GPIO pins reserved for future wiring). Feature parity with CirPy prototype — nothing more.

**TDD note:** Protocol frame encoding/decoding (Tasks 2–3) uses standard Rust `#[cfg(test)]` unit tests, run on the host via `cargo test`. Hardware-dependent tasks (BLE, GPIO, ADC) are verified by flashing and observing behaviour — there's no practical way to unit-test them without the physical hardware.

> **⚠️ `trouble` API note:** `trouble` is under active development. The code in BLE tasks (4–8, 10) shows the intended patterns. If the API has changed since this plan was written, consult the `trouble` nRF52840 peripheral examples at https://github.com/embassy-rs/trouble/tree/main/examples for current usage. The protocol module (Tasks 2–3) and hardware tasks (GPIO, ADC, LED) don't depend on `trouble` and won't be affected.

---

## Prerequisites

### 1. Install Rust toolchain

```powershell
# Install rustup (if not already installed)
winget install Rustlang.Rustup

# Install nightly toolchain + ARM Cortex-M4F target
rustup default nightly
rustup target add thumbv7em-none-eabihf

# Verify
rustup show
# Should show: nightly-x86_64-pc-windows-msvc (default)
# Installed targets: thumbv7em-none-eabihf
```

> **Why nightly?** Embassy uses unstable Rust features (`type_alias_impl_trait`, `async_fn_in_trait`). This is standard for embedded Rust in 2026 — many of these are close to stabilisation.

### 2. Install cargo-binutils (for binary conversion)

```powershell
cargo install cargo-binutils
rustup component add llvm-tools

# Verify
cargo objcopy --version
```

### 3. Install uf2conv (binary → UF2 converter)

```powershell
uv tool install uf2conv

# Verify
uf2conv --help
```

> **No debug probe required.** Unlike the SoftDevice approach, you do NOT need probe-rs, WCH-Link, SWD wiring, or any debug hardware. The existing Adafruit nRF52 UF2 bootloader on the SuperMini handles flashing via USB.

---

## Flash Workflow

**After Task 1 (automated — no touching the board):**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
# Script: builds → converts → sends 'b' over serial → waits for bootloader drive → copies .uf2
# Board auto-reboots into new firmware. Total cycle: ~5-10 seconds.
```

**How it works internally:**

1. `cargo build --release` — compile firmware
2. `cargo objcopy --release -- -O binary firmware.bin` — ELF → raw binary
3. `uf2conv firmware.bin --base 0x26000 --family 0xADA52840 --output firmware.uf2` — binary → UF2
4. Send `b` over COM port → firmware writes `0x57` to GPREGRET register and resets
5. Board boots into UF2 bootloader → USB drive `NRF52BOOT` appears
6. Copy `firmware.uf2` to the drive → board auto-reboots into new firmware

**First flash only (Task 0 — before USB serial exists):** manually short RST to GND twice to enter bootloader.

A convenience script (`flash.ps1`) is created in Task 0 and upgraded with serial bootloader entry in Task 1.

> **First-time bootloader entry from CircuitPython:** While CirPy is still installed, you can enter the bootloader without touching any pads. Add this to `code.py` temporarily and save:
> ```python
> import microcontroller
> microcontroller.on_next_reset(microcontroller.RunMode.UF2)
> microcontroller.reset()
> ```
> The board reboots into the UF2 bootloader drive. This is only needed once — after Task 1, the Rust firmware includes its own `enter_bootloader()` triggered by sending `b` over USB serial.

> **Software bootloader entry (Task 1+):** The firmware monitors USB serial input. When it receives `b`, it writes magic value `0x57` to the nRF52840's `GPREGRET` register and triggers a system reset. The Adafruit bootloader checks this register on boot — if it sees `0x57`, it stays in UF2 mode instead of jumping to the application. This means `flash.ps1` can enter the bootloader automatically without any physical interaction.

> **Returning to CircuitPython:** Same process — short RST to GND twice (or send `b` if Rust firmware is running), download the CircuitPython `.uf2` for nRF52840 from circuitpython.org and copy it to the bootloader drive. The UF2 bootloader is never erased.

> **Emergency recovery:** If firmware crashes before USB init (e.g. panic in `main` before the USB task starts), you'll need to manually short RST to GND twice. This should only happen during Task 0 development or if you introduce a very early crash.

---

## File Structure

All new files live in `open-elin-firmware-rust/`:

```
open-elin-firmware-rust/
├── .cargo/
│   └── config.toml          # target chip
├── Cargo.toml                # dependencies
├── build.rs                  # copies memory.x to OUT_DIR for linker
├── flash.ps1                 # build + convert + flash convenience script
├── memory.x                  # flash/RAM layout (after UF2 bootloader)
└── src/
    ├── main.rs               # entry point, BLE, tasks
    └── protocol.rs           # frame encoding/decoding (unit-testable on host)
```

---

## Task 0: Project Skeleton + Blink LED ✅

> **Note:** Completed with deviations — used raw GPIO register access + poll-based `delay_ms()` instead of Embassy GPIO HAL + Timer (because Timer panics). flash.ps1 not created (manual `Copy-Item` to E:\ instead).

**Goal:** Prove the toolchain works end-to-end: build Rust → convert to UF2 → flash to SuperMini via USB → LED blinks.

**Files:**
- Create: `open-elin-firmware-rust/.cargo/config.toml`
- Create: `open-elin-firmware-rust/Cargo.toml`
- Create: `open-elin-firmware-rust/build.rs`
- Create: `open-elin-firmware-rust/memory.x`
- Create: `open-elin-firmware-rust/src/main.rs`
- Create: `open-elin-firmware-rust/flash.ps1`

- [✅] **Step 1: Create `.cargo/config.toml`**

```toml
# open-elin-firmware-rust/.cargo/config.toml

[build]
target = "thumbv7em-none-eabihf"

# No runner — we flash via UF2, not probe-rs
```

- [✅] **Step 2: Create `Cargo.toml`**

```toml
# open-elin-firmware-rust/Cargo.toml
[package]
name = "open-elin-firmware-rust"
version = "0.1.0"
edition = "2021"

[dependencies]
# Embassy core
embassy-executor = { version = "0.7", features = ["arch-cortex-m", "executor-thread"] }
embassy-time = { version = "0.4" }
embassy-nrf = { version = "0.3", features = ["nrf52840", "time-driver-rtc1", "gpiote"] }
embassy-sync = { version = "0.6" }
embassy-futures = "0.1"

# BLE — trouble (pure Rust BLE host) + nrf-sdc (Nordic controller, linked into binary)
trouble-host = { version = "0.1", features = ["gatt", "peripheral"] }
nrf-sdc = { version = "0.1", features = ["nrf52840", "peripheral"] }
nrf-mpsl = { version = "0.1", features = ["nrf52840"] }

# USB serial logging
embassy-usb = { version = "0.4" }
embassy-usb-logger = "0.3"
log = "0.4"

# Core embedded
cortex-m = { version = "0.7", features = ["critical-section-single-core", "inline-asm"] }
cortex-m-rt = "0.7"
panic-halt = "1.0"
static_cell = "2"

# Allow host-side unit tests for protocol module
[lib]
name = "open_elin_firmware"
path = "src/protocol.rs"

[profile.release]
opt-level = "s"       # optimise for size (also helps power — less flash = faster wake)
lto = true
```

> **Dependency note:** Exact version numbers may need adjusting to whatever is current when you start. Run `cargo add <crate>` to get the latest compatible versions, then pin them in Cargo.toml. The feature flags above are the important part. Check `trouble`'s README for current version and features: https://github.com/embassy-rs/trouble

- [✅] **Step 3: Create `build.rs`**

```rust
// open-elin-firmware-rust/build.rs
fn main() {
    let out = std::env::var("OUT_DIR").unwrap();
    std::fs::copy("memory.x", format!("{out}/memory.x")).unwrap();
    println!("cargo:rustc-link-search={out}");
    println!("cargo:rerun-if-changed=memory.x");
}
```

- [✅] **Step 4: Create `memory.x`**

```
/* open-elin-firmware-rust/memory.x */
/* UF2 bootloader layout (Adafruit nRF52 bootloader on SuperMini):       */
/*   0x00000000..0x00001000  MBR (Master Boot Record, 4 KB)               */
/*   0x00001000..0x00026000  Reserved (SoftDevice region, unused by us)    */
/*   0x00026000..0x000F4000  Application (824 KB) ← our firmware goes here*/
/*   0x000F4000..0x00100000  Bootloader + settings (48 KB)                 */
/*                                                                         */
/* RAM: full 256 KB available (no SoftDevice eating the first 64 KB)       */
/* nrf-sdc will allocate from this pool at runtime.                        */

MEMORY
{
    FLASH : ORIGIN = 0x00026000, LENGTH = 824K
    RAM   : ORIGIN = 0x20000000, LENGTH = 256K
}
```

- [✅] **Step 5: Write minimal `main.rs` — blink LED** (raw GPIO + poll delay, not Embassy GPIO + Timer)

```rust
// open-elin-firmware-rust/src/main.rs
#![no_std]
#![no_main]

use panic_halt as _;

use embassy_executor::Spawner;
use embassy_nrf::gpio::{Level, Output, OutputDrive};
use embassy_time::Timer;

#[embassy_executor::main]
async fn main(_spawner: Spawner) {
    let p = embassy_nrf::init(Default::default());

    // SuperMini blue LED is on P0.15 (active-low on some boards, active-high on others).
    // If the LED doesn't light up, try Level::High → Level::Low and vice versa.
    let mut led = Output::new(p.P0_15, Level::Low, OutputDrive::Standard);

    loop {
        led.set_high();
        Timer::after_millis(200).await;
        led.set_low();
        Timer::after_millis(800).await;
    }
}
```

> **No log output yet** — USB serial logging is added in Task 1. For this task, the blinking LED is your proof that it works.

- [ ] **Step 6: Create `flash.ps1` convenience script** (skipped — manual flash via `Copy-Item firmware.uf2 E:\`)

```powershell
# open-elin-firmware-rust/flash.ps1
# Build, convert to UF2, and flash the firmware via USB bootloader.
# Usage: .\flash.ps1
#   Fully automated after Task 1 — sends 'b' over serial to enter bootloader.
#   For Task 0 (no serial yet): use -Drive D:\ after manually entering bootloader.

param(
    [string]$Drive = "",
    [switch]$NoSerial  # Skip serial bootloader entry (for Task 0 / emergency)
)

$ErrorActionPreference = "Stop"

Write-Host "Building firmware..." -ForegroundColor Cyan
cargo build --release
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Converting to binary..." -ForegroundColor Cyan
cargo objcopy --release -- -O binary firmware.bin
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Converting to UF2..." -ForegroundColor Cyan
uf2conv firmware.bin --base 0x26000 --family 0xADA52840 --output firmware.uf2
if ($LASTEXITCODE -ne 0) { exit 1 }

# Enter bootloader via serial command (Task 1+)
if (-not $NoSerial -and -not $Drive) {
    $port = [System.IO.Ports.SerialPort]::GetPortNames() | Select-Object -First 1
    if ($port) {
        Write-Host "Sending bootloader command to $port..." -ForegroundColor Cyan
        $serial = New-Object System.IO.Ports.SerialPort $port, 115200
        $serial.Open()
        $serial.Write("b")
        $serial.Close()
        # Wait for board to reboot into bootloader and USB drive to appear
        Write-Host "Waiting for bootloader drive..." -ForegroundColor Cyan
        $timeout = 10
        for ($i = 0; $i -lt $timeout; $i++) {
            Start-Sleep -Seconds 1
            $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO" } |
                         Select-Object -First 1
            if ($bootDrive) { break }
        }
        if (-not $bootDrive) {
            Write-Host "Bootloader drive did not appear. Try -NoSerial and manual RST short." -ForegroundColor Red
            exit 1
        }
        $Drive = "$($bootDrive.DriveLetter):\"
        Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
    } else {
        Write-Host "No COM port found. Is the board connected?" -ForegroundColor Red
        exit 1
    }
}

# Auto-detect bootloader drive if not specified (for -NoSerial / Task 0)
if (-not $Drive) {
    $bootDrive = Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT|NICENANO" } |
                 Select-Object -First 1
    if ($bootDrive) {
        $Drive = "$($bootDrive.DriveLetter):\"
        Write-Host "Found bootloader drive: $Drive" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Short RST to GND twice on the SuperMini, then re-run:" -ForegroundColor Yellow
        Write-Host "  .\flash.ps1 -Drive D:\" -ForegroundColor Yellow
        Write-Host "(replace D: with whatever drive letter appears)" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Copying firmware.uf2 to $Drive ..." -ForegroundColor Cyan
Copy-Item firmware.uf2 $Drive
Write-Host "Done! Board will reboot into new firmware." -ForegroundColor Green
```

- [✅] **Step 7: Build and flash**

```powershell
cd open-elin-firmware-rust

# Task 0 — first flash (no USB serial yet, must manually enter bootloader):
# 1. Enter bootloader: use CirPy trick (microcontroller.on_next_reset) or short RST to GND twice
# 2. Run the script with -NoSerial since firmware doesn't have serial input yet:
.\flash.ps1 -NoSerial

# From Task 1 onward — fully automated (no touching the board):
.\flash.ps1
```

You should see the blue LED blinking on the SuperMini (200ms on, 800ms off).

If the LED polarity is inverted (stays ON during the "off" phase), swap `Level::Low` to `Level::High` in the `Output::new` call.

- [ ] **Step 8: Commit** (not committed)

```powershell
git add open-elin-firmware-rust/
git commit -m "feat(firmware): embassy project skeleton + LED blink (UF2)"
```

---

## Task 1: USB Serial Logging ⛔ BLOCKED (Timer crash)

**Goal:** Set up USB CDC serial logging so you can see debug output in a serial terminal (like CirPy's `print()` → USB console). This is your `console.log()` for embedded.

**Files:**
- Modify: `open-elin-firmware-rust/Cargo.toml` (already has deps from Task 0)
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Add USB serial logging to main.rs**

Replace `main.rs` with a version that initialises the USB CDC serial port and uses `log::info!()` for output:

```rust
// open-elin-firmware-rust/src/main.rs
#![no_std]
#![no_main]

use panic_halt as _;

use embassy_executor::Spawner;
use embassy_nrf::gpio::{Level, Output, OutputDrive};
use embassy_nrf::usbd::{Driver, InterruptHandler as UsbInterruptHandler};
use embassy_nrf::{bind_interrupts, peripherals};
use embassy_time::Timer;
use embassy_usb::class::cdc_acm::{CdcAcmClass, State};
use embassy_usb::UsbDevice;
use log::{info, LevelFilter};
use static_cell::StaticCell;

bind_interrupts!(struct Irqs {
    USBD => UsbInterruptHandler<peripherals::USBD>;
    POWER_CLOCK => embassy_nrf::usbd::vbus_detect::InterruptHandler;
});

// USB serial logger — bridges `log` crate to USB CDC ACM
// (embassy-usb-logger wraps this boilerplate; if it's not available as a
// separate crate, use the manual CDC approach from Embassy examples)

#[embassy_executor::task]
async fn usb_task(mut device: UsbDevice<'static, Driver<'static, peripherals::USBD>>) {
    device.run().await;
}

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_nrf::init(Default::default());

    // USB CDC serial setup
    let driver = Driver::new(p.USBD, Irqs, embassy_nrf::usbd::vbus_detect::HardwareVbusDetect::new(Irqs));

    static CONFIG_DESC: StaticCell<[u8; 256]> = StaticCell::new();
    static BOS_DESC: StaticCell<[u8; 256]> = StaticCell::new();
    static CONTROL_BUF: StaticCell<[u8; 128]> = StaticCell::new();
    static STATE: StaticCell<State> = StaticCell::new();

    let mut config = embassy_usb::Config::new(0x1209, 0x0001); // pid.codes test VID/PID
    config.manufacturer = Some("open-elin");
    config.product = Some("NXS Pod Firmware");
    config.serial_number = Some("001");

    let mut builder = embassy_usb::Builder::new(
        driver,
        config,
        CONFIG_DESC.init([0; 256]),
        BOS_DESC.init([0; 256]),
        &mut [], // msos descriptors
        CONTROL_BUF.init([0; 128]),
    );

    let state = STATE.init(State::new());
    const USB_PACKET_SIZE: u16 = 64; // USB full-speed bulk endpoint max
    let _class = CdcAcmClass::new(&mut builder, state, USB_PACKET_SIZE);

    let usb = builder.build();
    spawner.spawn(usb_task(usb)).unwrap();

    // NOTE: For full log integration, use embassy-usb-logger if available,
    // or write a simple log::Log impl that writes to the CDC class.
    // For now, the USB serial port appears on the PC but log output
    // requires the log bridge. See Embassy's usb_serial example.

    let mut led = Output::new(p.P0_15, Level::Low, OutputDrive::Standard);

    // info!("open-elin-firmware-rust v{}", env!("CARGO_PKG_VERSION"));
    // info!("chip: nRF52840  board: SuperMini");

    let mut count: u32 = 0;
    loop {
        led.set_high();
        Timer::after_millis(200).await;
        led.set_low();
        Timer::after_millis(800).await;
        count += 1;
        // info!("blink #{}", count);
    }
}
```

> **USB serial note:** The exact `embassy-usb-logger` or manual `log::Log` implementation depends on what's currently available. The Embassy `usb_serial` example for nRF52840 is the canonical reference. The key point: after this task, connecting the SuperMini via USB shows a serial port on your PC, and `log::info!()` messages appear there.

- [ ] **Step 2: Flash and verify USB serial**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

After flashing:
1. The LED should still blink (200ms on, 800ms off)
2. A new COM port should appear in Device Manager (or `Get-WmiObject Win32_SerialPort`)
3. Open a serial terminal (PuTTY, VS Code Serial Monitor, or `minicom`) at any baud rate
4. You should see log messages: `open-elin-firmware-rust v0.1.0`, `blink #1`, etc.

If no COM port appears, check that the USB cable is a data cable (not charge-only).

- [ ] **Step 3: Add `enter_bootloader()` and serial input handler**

Add a function that triggers a reboot into the UF2 bootloader:

```rust
/// Magic value the Adafruit nRF52 bootloader checks in GPREGRET on reset.
/// If present, bootloader stays in UF2/DFU mode instead of jumping to app.
const BOOTLOADER_DFU_MAGIC: u32 = 0x57;

/// Reboot into the UF2 bootloader (Adafruit nRF52 bootloader).
fn enter_bootloader() -> ! {
    unsafe {
        let power = &*embassy_nrf::pac::POWER::ptr();
        power.gpregret.write(|w| w.bits(BOOTLOADER_DFU_MAGIC));
    }
    cortex_m::peripheral::SCB::sys_reset();
}
```

Add a serial input task that watches for `b`:

```rust
#[embassy_executor::task]
async fn serial_input_task(/* CDC class reader */) {
    let mut buf = [0u8; 64];
    loop {
        // Read from USB CDC serial
        let n = /* class.read_packet(&mut buf).await */;
        for &byte in &buf[..n] {
            if byte == b'b' {
                log::info!("bootloader command received — rebooting");
                enter_bootloader();
            }
        }
    }
}
```

> **Note:** The exact `CdcAcmClass` read API depends on the Embassy version. The key point: spawn a task that reads from the CDC class, check for `b`, call `enter_bootloader()`. This enables `flash.ps1` to trigger bootloader entry automatically from Task 1 onward.

- [ ] **Step 4: Flash and verify bootloader entry**

Flash using `-NoSerial` (since this is the first time this feature exists):

```powershell
cd open-elin-firmware-rust
.\flash.ps1 -NoSerial
```

Then verify the new serial bootloader entry works:

```powershell
# Open a serial connection and send 'b':
$port = [System.IO.Ports.SerialPort]::GetPortNames() | Select-Object -First 1
$serial = New-Object System.IO.Ports.SerialPort $port, 115200
$serial.Open(); $serial.Write("b"); $serial.Close()
# NRF52BOOT drive should appear within a few seconds
Get-Volume | Where-Object { $_.FileSystemLabel -match "NRF52|BOOT" }
```

If the drive appears, `flash.ps1` (without `-NoSerial`) will work automatically from now on.

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(firmware): USB serial logging + bootloader entry via serial command"
```

---

## Task 2: Protocol Frame Encoding (TDD) ✅

**Goal:** Implement button notification and battery notification frame encoding with host-side unit tests. This module has **no hardware dependencies** — it's pure byte manipulation, tested with `cargo test` on your PC.

**Files:**
- Create: `open-elin-firmware-rust/src/protocol.rs`
- Modify: `open-elin-firmware-rust/src/main.rs` (add `mod protocol;`)

- [ ] **Step 1: Write the failing tests**

Create `open-elin-firmware-rust/src/protocol.rs`:

```rust
// open-elin-firmware-rust/src/protocol.rs

/// BikeNet protocol opcodes (stored as little-endian byte pairs, ready to copy into frames)
const OPCODE_BUTTON: [u8; 2] = 0x4001_u16.to_le_bytes();   // pod → hub: button action
const OPCODE_BATTERY: [u8; 2] = 0x4000_u16.to_le_bytes();  // pod → hub: battery voltage

/// Button action flags
pub const ACTION_PRESS: u8 = 0x00;
pub const ACTION_RELEASE: u8 = 0x01;

/// Encode a button notification frame (10 bytes).
///
/// Format: [opcode 2B LE] [pod MAC 6B LE] [buttonId 1B] [actionFlag 1B]
pub fn encode_button(mac_le: &[u8; 6], button_id: u8, action: u8) -> [u8; 10] {
    todo!()
}

/// Encode a battery voltage notification frame (10 bytes).
///
/// Format: [opcode 2B LE] [pod MAC 6B LE] [voltage_mV 2B LE]
pub fn encode_battery(mac_le: &[u8; 6], mv: u16) -> [u8; 10] {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    const FAKE_MAC: [u8; 6] = [0x43, 0xB5, 0x0B, 0x23, 0x4F, 0xC2]; // C2:4F:23:0B:B5:43 LE

    #[test]
    fn button_press_encodes_correctly() {
        let frame = encode_button(&FAKE_MAC, 0x01, ACTION_PRESS);
        // Opcode 0x4001 LE
        assert_eq!(frame[0], 0x01);
        assert_eq!(frame[1], 0x40);
        // MAC
        assert_eq!(&frame[2..8], &FAKE_MAC);
        // Button ID
        assert_eq!(frame[8], 0x01);
        // Action = press
        assert_eq!(frame[9], ACTION_PRESS);
    }

    #[test]
    fn button_release_encodes_correctly() {
        let frame = encode_button(&FAKE_MAC, 0x00, ACTION_RELEASE);
        assert_eq!(frame[8], 0x00);
        assert_eq!(frame[9], ACTION_RELEASE);
    }

    #[test]
    fn battery_encodes_mv_little_endian() {
        let frame = encode_battery(&FAKE_MAC, 2871); // 0x0B37
        // Opcode 0x4000 LE
        assert_eq!(frame[0], 0x00);
        assert_eq!(frame[1], 0x40);
        // MAC
        assert_eq!(&frame[2..8], &FAKE_MAC);
        // Voltage 2871 = 0x0B37 → LE bytes [0x37, 0x0B]
        assert_eq!(frame[8], 0x37);
        assert_eq!(frame[9], 0x0B);
    }
}
```

- [ ] **Step 2: Run tests — verify they fail**

```powershell
cd open-elin-firmware-rust
cargo test
```

Expected: 3 failures, all with `not yet implemented` (from `todo!()`).

- [✅] **Step 3: Implement the encoding functions**

Replace the `todo!()` bodies:

```rust
pub fn encode_button(mac_le: &[u8; 6], button_id: u8, action: u8) -> [u8; 10] {
    let mut buf = [0u8; 10];
    buf[0..2].copy_from_slice(&OPCODE_BUTTON);
    buf[2..8].copy_from_slice(mac_le);
    buf[8] = button_id;
    buf[9] = action;
    buf
}

pub fn encode_battery(mac_le: &[u8; 6], mv: u16) -> [u8; 10] {
    let mut buf = [0u8; 10];
    buf[0..2].copy_from_slice(&OPCODE_BATTERY);
    buf[2..8].copy_from_slice(mac_le);
    buf[8..10].copy_from_slice(&mv.to_le_bytes());
    buf
}
```

- [✅] **Step 4: Run tests — verify they pass**

```powershell
cargo test
```

Expected: `test result: ok. 3 passed`

- [✅] **Step 5: Add `mod protocol;` to main.rs**

At the top of `src/main.rs`, below the `use` statements:

```rust
mod protocol;
```

Verify it still compiles for the target:

```powershell
cargo build --release
```

- [ ] **Step 6: Commit** (not committed)

```powershell
git add -A
git commit -m "feat(firmware): protocol frame encoding with tests"
```

---

## Task 3: ShiftComplete Parsing (TDD) ✅

**Goal:** Parse ShiftComplete frames (opcode 0x4003) from raw MSG characteristic data. This prepares for the case where the hub writes ShiftComplete to the pod after a shift — **whether this actually happens is unverified** (see `documents/OBSERVED-BEHAVIOR.md` → "Hub → Pod Communication"). The parser is cheap to include and the tests document the wire format either way. If the hub does write ShiftComplete, we get gear tracking for free.

> **What we know vs what we assume:** ShiftComplete (opcode `0x4003`) was observed as a **hub→app notification** on the hub's MSG characteristic (`targetMac = hub MAC`). The CirPy code includes a parser for it on the pod side (`msg_char.value`), but this code was **never confirmed to fire** — no `← MSG` log line containing ShiftComplete data has been recorded. With separate up/down buttons (Task 6), direction-cycling is no longer needed — ShiftComplete is purely for gear tracking and discovery.

> **Gear byte encoding (from observed data):** Byte 10 in the frame is a **0-indexed gear number**. Cross-referenced with Position notifications: value `0x07` = gearPosition 8, value `0x06` = gearPosition 7, value `0x01` = gearPosition 2. For a 12-speed cassette, range is `0x00`–`0x0B` (0–11).

**Files:**
- Modify: `open-elin-firmware-rust/src/protocol.rs`

- [✅] **Step 1: Write the failing tests**

Append to `protocol.rs`, above `#[cfg(test)]`:

```rust
/// Opcode for shift-complete (hub → pod via MSG write, if it happens): 0x4003
/// NOTE: Whether the hub actually writes this to the pod is unverified.
/// Observed only as a hub → app notification. See OBSERVED-BEHAVIOR.md.
const OPCODE_SHIFT_COMPLETE: u16 = 0x4003;

/// Parsed ShiftComplete message from the hub.
pub struct ShiftComplete {
    pub gear: u8,
}

/// Parse a ShiftComplete message from raw MSG characteristic data.
/// Returns `None` if the data isn't a ShiftComplete frame.
pub fn parse_shift_complete(data: &[u8]) -> Option<ShiftComplete> {
    todo!()
}
```

Add tests inside the `mod tests` block:

```rust
    #[test]
    fn parse_shift_complete_valid() {
        // Observed on hub monitor: opcode 0x4003 LE, 6-byte hub MAC, payload [0x1F, 0x00, 0x01]
        // Byte 10 = 0x01 = gear index (0-based) → gearPosition 2
        // Whether this frame is written to the pod's MSG char is unverified.
        let data: [u8; 11] = [
            0x03, 0x40, // opcode 0x4003 LE
            0xE5, 0xA0, 0x52, 0xAB, 0xBA, 0xD7, // hub MAC LE
            0x1F, 0x00, 0x01, // payload — gear index (0-based) at byte 10
        ];
        let result = parse_shift_complete(&data).unwrap();
        assert_eq!(result.gear, 0x01); // 0-indexed: gear index 1 = gearPosition 2
    }

    #[test]
    fn parse_shift_complete_wrong_opcode() {
        let data: [u8; 11] = [
            0x01, 0x40, // opcode 0x4001 (button, not shift)
            0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        assert!(parse_shift_complete(&data).is_none());
    }

    #[test]
    fn parse_shift_complete_too_short() {
        let data: [u8; 5] = [0x03, 0x40, 0, 0, 0];
        assert!(parse_shift_complete(&data).is_none());
    }
```

- [ ] **Step 2: Run tests — verify they fail**

```powershell
cargo test
```

Expected: 3 new failures from `todo!()`, 3 existing tests still pass.

- [✅] **Step 3: Implement parsing**

Replace the `todo!()` body:

```rust
pub fn parse_shift_complete(data: &[u8]) -> Option<ShiftComplete> {
    if data.len() < 11 {
        return None;
    }
    let opcode = u16::from_le_bytes([data[0], data[1]]);
    if opcode != OPCODE_SHIFT_COMPLETE {
        return None;
    }
    Some(ShiftComplete { gear: data[10] })
}
```

- [✅] **Step 4: Run tests — verify all pass**

```powershell
cargo test
```

Expected: `test result: ok. 6 passed`

- [ ] **Step 5: Commit** (not committed)

```powershell
git commit -am "feat(firmware): ShiftComplete parsing with tests"
```

---

## Task 4: BLE Advertising ⛔ BLOCKED (Timer crash)

**Goal:** Initialise the `trouble` BLE stack and advertise as `NXS MTB Pod` with the exact same advertisement data as the real pod. Verify with `nRF Connect` or a BLE scan from the CLI.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Rewrite main.rs for trouble BLE + advertising**

Replace the entire `main.rs`. The blink-only code is no longer needed — the BLE stack takes over.

> **API check:** Before implementing, read through `trouble`'s nRF52840 peripheral example at https://github.com/embassy-rs/trouble/tree/main/examples — the exact controller setup and advertising API may differ from what's shown below. The overall pattern (create controller → create host → advertise → accept connection) is stable.

```rust
// open-elin-firmware-rust/src/main.rs
#![no_std]
#![no_main]

use panic_halt as _;

use embassy_executor::Spawner;
use embassy_nrf as _;
use embassy_time::Timer;
use trouble_host::prelude::*;

mod protocol;

/// Read the device's BLE MAC address from the nRF52840 FICR registers.
fn read_device_mac() -> [u8; 6] {
    let ficr = unsafe { &*embassy_nrf::pac::FICR::ptr() };
    let w0 = ficr.deviceaddr(0).read().bits().to_le_bytes(); // [u8; 4]
    let w1 = ficr.deviceaddr(1).read().bits().to_le_bytes(); // [u8; 4]
    [w0[0], w0[1], w0[2], w0[3], w1[0], w1[1]]
}

// BLE AD type codes (Bluetooth Core Spec, Vol 3, Part C, §11)
const AD_FLAGS: u8 = 0x01;
const AD_MANUFACTURER_DATA: u8 = 0xFF;
const AD_COMPLETE_LOCAL_NAME: u8 = 0x09;
const AD_COMPLETE_128BIT_UUIDS: u8 = 0x07;

// BLE flags value: LE General Discoverable + BR/EDR Not Supported
const FLAGS_LE_GENERAL: u8 = 0x06;

// NXS manufacturer-specific constants
const NXS_COMPANY_ID: [u8; 2] = 0xDE98_u16.to_le_bytes();
const NXS_DEVICE_TYPE: [u8; 2] = [0x0A, 0x10]; // identifies pod hardware

/// Build raw advertisement data matching the real NXS MTB Pod.
/// Returns (adv_data, scan_response) byte arrays.
fn build_adv_data(own_mac_le: &[u8; 6]) -> ([u8; 29], [u8; 18]) {
    let mut adv = [0u8; 29];
    let mut i = 0;

    // AD: Flags
    adv[i] = 2; adv[i+1] = AD_FLAGS; adv[i+2] = FLAGS_LE_GENERAL;
    i += 3;

    // AD: Manufacturer Specific Data — company ID, device type, MAC, trailing 0x00
    adv[i] = 12; adv[i+1] = AD_MANUFACTURER_DATA;
    adv[i+2..i+4].copy_from_slice(&NXS_COMPANY_ID);
    adv[i+4..i+6].copy_from_slice(&NXS_DEVICE_TYPE);
    adv[i+6..i+12].copy_from_slice(own_mac_le);
    adv[i+12] = 0x00;
    i += 13;

    // AD: Complete Local Name
    let name = b"NXS MTB Pod";
    adv[i] = (name.len() + 1) as u8;
    adv[i+1] = AD_COMPLETE_LOCAL_NAME;
    adv[i+2..i+2+name.len()].copy_from_slice(name);

    // Scan response: 128-bit Service UUID
    let mut scan = [0u8; 18];
    scan[0] = 17;
    scan[1] = AD_COMPLETE_128BIT_UUIDS;
    let svc_uuid_le: [u8; 16] = [
        0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
        0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5,
    ];
    scan[2..18].copy_from_slice(&svc_uuid_le);

    (adv, scan)
}

#[embassy_executor::main]
async fn main(_spawner: Spawner) {
    let p = embassy_nrf::init(Default::default());

    log::info!("open-elin-firmware-rust booting");

    // Read our MAC from the chip's factory registers
    let mac_le = read_device_mac();
    log::info!("BLE address: {:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
        mac_le[5], mac_le[4], mac_le[3], mac_le[2], mac_le[1], mac_le[0]);

    // ── trouble BLE stack init ──
    // Create the nrf-sdc BLE controller (links Nordic's SDC static library)
    // Then create the trouble BLE host on top of it.
    //
    // NOTE: The exact controller/host creation API depends on the current
    // trouble version. Check trouble's nRF52840 peripheral example for the
    // current init sequence. The pattern is:
    //
    //   let controller = nrf_sdc::Controller::new(/* peripherals, config */);
    //   let host = trouble_host::new(controller);
    //   let mut table = AttributeTable::new();
    //   // ... add services/characteristics ...
    //   let server = GattServer::new(&host, &table);
    //
    // For now, this task focuses on advertising. GATT comes in Task 5.

    let (adv_data, scan_data) = build_adv_data(&mac_le);

    log::info!("starting advertisement as 'NXS MTB Pod'");

    // Advertising loop — advertise, wait for connection, handle disconnect, repeat
    loop {
        // trouble's peripheral advertise API — consult current docs for exact signature
        // let conn = host.advertise(&AdvConfig {
        //     adv_data: &adv_data,
        //     scan_data: &scan_data,
        // }).await;

        log::info!("hub connected!");

        // For now, just wait for disconnect
        // conn.disconnect();
        log::info!("hub disconnected, re-advertising");
    }
}
```

> **Implementation guidance:** The commented-out sections show the intended API calls. When implementing, fill these in from `trouble`'s actual API. The `build_adv_data()` function and `read_device_mac()` are correct and complete — only the controller/host init and advertising call need adjusting.

- [ ] **Step 2: Flash and verify advertisement**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

From your PC, verify the pod is visible:

```powershell
# From the workspace root, use the CLI BLE scan:
npm run cli -- hub scan --timeout 5000
# OR use nRF Connect mobile app and look for "NXS MTB Pod"
```

You should see `NXS MTB Pod` in the scan results.

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(firmware): trouble BLE init + advertising"
```

---

## Task 5: GATT Service — MSG + PIN Characteristics ⛔ BLOCKED

**Goal:** Define the BikeNet GATT service with MSG and PIN characteristics (both write + notify). After this task, connecting to the pod via nRF Connect should show the service and characteristics.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Define the GATT service with trouble macros**

`trouble` provides `#[gatt_service]` and `#[gatt_server]` proc macros similar to `nrf-softdevice`. Add the service definition above `main()`:

```rust
use trouble_host::gatt::{GattServer, GattEvent};

/// Max ATT payload with default MTU (23 - 3 = 20 bytes). Our frames are 10–11 bytes
/// but the real pod advertises 20-byte characteristics, so we match that.
const CHAR_MAX_LEN: usize = 20;

#[gatt_service(uuid = "a5c1c000-cc20-ba91-0c1a-ef3f9e643d79")]
struct BikeNetService {
    /// MSG characteristic — button/battery notifications (pod→hub), commands (hub→pod)
    #[characteristic(uuid = "a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79", write, write_without_response, notify)]
    msg: [u8; CHAR_MAX_LEN],

    /// PIN characteristic — PIN exchange during pairing
    #[characteristic(uuid = "a5c1cc02-cc20-ba91-0c1a-ef3f9e643d79", write, write_without_response, notify)]
    pin: [u8; CHAR_MAX_LEN],
}

#[gatt_server]
struct Server {
    bikenet: BikeNetService,
}
```

> **API check:** The `trouble` macro syntax may differ slightly (e.g. `#[trouble::gatt_service(...)]` or different attribute names). Check `trouble`'s peripheral GATT example for the current syntax. The UUIDs and properties are correct.

- [ ] **Step 2: Create the GATT server and run it during connections**

Update `main()` — after BLE host init, create the server and handle connections:

```rust
    // Create GATT server with the BikeNet service
    let server = Server::new(/* &host or similar */);
    log::info!("GATT server created");

    loop {
        // Advertise and wait for connection
        let conn = /* host.advertise(...).await */;
        log::info!("hub connected!");

        // Run the GATT server — this handles reads/writes/notifications
        // until the connection drops.
        let result = server.run(&conn, |event| match event {
            ServerEvent::Bikenet(e) => match e {
                BikeNetServiceEvent::MsgWrite(data) => {
                    log::info!("← MSG write: {:02X?}", data);
                }
                BikeNetServiceEvent::PinWrite(data) => {
                    log::info!("← PIN write: {:02X?}", data);
                }
                BikeNetServiceEvent::MsgCccdWrite { notifications } => {
                    log::info!("MSG CCCD: notifications={}", notifications);
                }
                BikeNetServiceEvent::PinCccdWrite { notifications } => {
                    log::info!("PIN CCCD: notifications={}", notifications);
                }
            },
        }).await;

        log::info!("hub disconnected: {:?}", result);
    }
```

> **Generated types:** The proc macros generate `ServerEvent`, `BikeNetServiceEvent`, and method names like `msg_notify()`. The exact names depend on the macro implementation — if they differ, the compiler error messages will tell you the correct names.

- [ ] **Step 3: Flash and verify GATT service**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

Connect to the pod from nRF Connect (mobile) or your CLI. You should see:
- Service `A5C1C000-...`
- Characteristic `A5C1CC01-...` (MSG) with Write + Notify properties
- Characteristic `A5C1CC02-...` (PIN) with Write + Notify properties

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(firmware): GATT service with MSG + PIN characteristics"
```

---

## Task 6: Button Input — Serial Trigger (+ GPIO Reserved) ⛔ BLOCKED

**Goal:** Expose 3 buttons matching the real MTB Pod's wired ports: `-` (shift up, 0x00), `A-1` (shift down, 0x01), `A-2` (tune, 0x02). Since no physical buttons are soldered yet, trigger them via USB serial commands. GPIO pins are reserved for future wiring.

> **Real pod button IDs** (from `lib/src/pod-models.ts`): The MTB Pod exposes `wiredButtons: ["02", "00", "01"]` — button 0x00 (shift up), 0x01 (shift down), 0x02 (tune mode). The default button map assigns: 0x00→ShiftUp, 0x01→ShiftDown, 0x02→TuneMode.

**Serial commands:** `u` = shift up (0x00 press+release), `d` = shift down (0x01 press+release), `t` = tune (0x02 press+release). These are processed by the same serial input task that handles `b` (bootloader entry) from Task 1.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Define button constants and event signal**

Add above `main()`:

```rust
use embassy_sync::signal::Signal;
use embassy_sync::blocking_mutex::raw::CriticalSectionRawMutex;
use core::sync::atomic::Ordering;

/// Signal to tell the connection handler a button event occurred.
/// Payload: (button_id, action_flag)
static BUTTON_EVENT: Signal<CriticalSectionRawMutex, (u8, u8)> = Signal::new();

// Button IDs matching real MTB Pod ports (from pod-models.ts wiredButtons)
const BTN_SHIFT_UP: u8 = 0x00;   // "-" port
const BTN_SHIFT_DOWN: u8 = 0x01; // "A-1" port
const BTN_TUNE: u8 = 0x02;       // "A-2" port

// GPIO pins reserved for future physical buttons (active-low with internal pull-up)
// const PIN_BTN_UP: _ = p.P0_17;   // "-" port
// const PIN_BTN_DOWN: _ = p.P0_20; // "A-1" port
// const PIN_BTN_TUNE: _ = p.P0_22; // "A-2" port
```

- [ ] **Step 2: Expand serial input task to handle button triggers**

Update the serial input task (from Task 1) to also handle `u`, `d`, `t`:

```rust
#[embassy_executor::task]
async fn serial_input_task(/* CDC class reader */) {
    let mut buf = [0u8; 64];
    loop {
        let n = /* class.read_packet(&mut buf).await */;
        for &byte in &buf[..n] {
            match byte {
                b'b' => {
                    log::info!("bootloader command received — rebooting");
                    enter_bootloader();
                }
                b'u' => {
                    log::info!("serial → shift UP (btn 0x00)");
                    BUTTON_EVENT.signal((BTN_SHIFT_UP, protocol::ACTION_PRESS));
                    // Small delay then release — simulates a quick press
                    Timer::after_millis(50).await;
                    BUTTON_EVENT.signal((BTN_SHIFT_UP, protocol::ACTION_RELEASE));
                }
                b'd' => {
                    log::info!("serial → shift DOWN (btn 0x01)");
                    BUTTON_EVENT.signal((BTN_SHIFT_DOWN, protocol::ACTION_PRESS));
                    Timer::after_millis(50).await;
                    BUTTON_EVENT.signal((BTN_SHIFT_DOWN, protocol::ACTION_RELEASE));
                }
                b't' => {
                    log::info!("serial → TUNE (btn 0x02)");
                    BUTTON_EVENT.signal((BTN_TUNE, protocol::ACTION_PRESS));
                    Timer::after_millis(50).await;
                    BUTTON_EVENT.signal((BTN_TUNE, protocol::ACTION_RELEASE));
                }
                _ => {}
            }
        }
    }
}
```

- [ ] **Step 3: Handle button events in the connection loop**

In the GATT server event loop, use `select` to listen for button events alongside the GATT server:

```rust
use embassy_futures::select::{select, Either};

        // Run GATT server and button handler concurrently
        loop {
            let gatt_fut = server.run(&conn, |event| {
                // ... same event handler as before ...
            });

            match select(gatt_fut, BUTTON_EVENT.wait()).await {
                Either::First(result) => {
                    // GATT server ended = disconnected
                    log::info!("disconnected: {:?}", result);
                    break;
                }
                Either::Second((btn_id, action)) => {
                    let frame = protocol::encode_button(&mac_le, btn_id, action);
                    if let Err(e) = server.bikenet.msg_notify(&conn, &frame) {
                        log::warn!("notify failed: {:?}", e);
                    }
                }
            }
        }
```

> **Note:** The `select` approach above is simplified. In practice, you may need to restructure so the GATT server keeps running while also processing button events. The `embassy-futures` crate provides `select` for this. Already in `Cargo.toml` from Task 0.

- [ ] **Step 4: Flash and verify with hub monitor**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

From another terminal, pair and monitor:

```powershell
npm run cli -- hub add-device --address d7:ba:ab:52:a0:e5 --timeout 15000 <POD-MAC>
npm run cli -- hub monitor --address d7:ba:ab:52:a0:e5
```

Open a serial terminal to the pod's COM port and type `u`, `d`, `t`. You should see `button-action` events in the hub monitor with the correct button IDs (0x00, 0x01, 0x02) and press/release actions.

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(firmware): 3-button input via serial trigger (GPIO reserved)"
```

---

## Task 7: Battery ADC + Periodic Reporting ⛔ BLOCKED

**Goal:** Read battery voltage via ADC and send a battery notification every 5 seconds while connected, matching the CirPy prototype behaviour.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Add battery task**

The nice!nano / SuperMini has a voltage divider on AIN2 (P0.04): R6=806kΩ / R7=2MΩ. The ADC reads the divided voltage; multiply by the divider ratio to get actual VBAT.

Add this task:

```rust
use embassy_nrf::saadc::{self, ChannelConfig, Config as SaadcConfig, Saadc};

/// Signal that a battery reading is available. Payload: voltage in mV.
static BATTERY_MV: Signal<CriticalSectionRawMutex, u16> = Signal::new();

#[embassy_executor::task]
async fn battery_task(mut saadc: Saadc<'static, 1>) {
    loop {
        let mut buf = [0i16; 1];
        saadc.sample(&mut buf).await;

        // ADC reference = 0.6V internal, gain = 1/6 → full scale = 3.6V
        // Resolution = 12 bits → 4096 counts = 3.6V
        // Voltage divider ratio: (806k + 2M) / 2M ≈ 1.403
        // Actual VBAT = (adc_raw / 4096) * 3.6 * 1.403 * 1000 (mV)
        let raw = buf[0].max(0) as u32;
        let mv = ((raw * 3600 * 1403) / (4096 * 1000)) as u16;

        log::info!("battery: {} mV (raw ADC: {})", mv, raw);
        BATTERY_MV.signal(mv);

        Timer::after_secs(5).await;
    }
}
```

- [ ] **Step 2: Initialise SAADC and spawn battery task**

In `main()`, before the advertising loop:

```rust
    // Battery ADC — AIN2 (P0.04) with voltage divider
    let adc_config = SaadcConfig::default();
    let channel = ChannelConfig::single_ended(p.P0_04);
    let saadc = Saadc::new(p.SAADC, Irqs, adc_config, [channel]);

    static SAADC_CELL: StaticCell<Saadc<'static, 1>> = StaticCell::new();
    let saadc = SAADC_CELL.init(saadc);
    _spawner.spawn(battery_task(saadc)).unwrap(); // TODO: may need ownership adjustment
```

> **Ownership note:** Embassy tasks need `'static` lifetimes. The `StaticCell` pattern is the standard way to give a peripheral a `'static` lifetime. The exact API may vary — consult Embassy docs for the current `Saadc` constructor signature.

- [ ] **Step 3: Send battery notification on signal**

In the connection loop, add battery handling alongside button events. Use `select3` (or restructure the loop) to also listen for `BATTERY_MV`:

```rust
                Either::Second(mv) => {
                    // from BATTERY_MV signal
                    let frame = protocol::encode_battery(&mac_le, mv);
                    if let Err(e) = server.bikenet.msg_notify(&conn, &frame) {
                        log::warn!("battery notify failed: {:?}", e);
                    }
                }
```

- [ ] **Step 4: Flash and verify**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

Monitor from CLI:
```powershell
npm run cli -- hub monitor --address d7:ba:ab:52:a0:e5
```

You should see `battery-voltage` events every ~5 seconds with a reasonable mV reading (3000–4200 for LiPo, or whatever voltage your USB is providing through the divider).

- [ ] **Step 5: Commit**

```powershell
git commit -am "feat(firmware): battery ADC + periodic voltage reporting"
```

---

## Task 8: Hub Message Handling — PIN Exchange + ShiftComplete ⛔ BLOCKED

**Goal:** Handle incoming writes from the hub on the pod's GATT characteristics:
1. **PIN write** → respond with ACK byte `0x01` (confirmed: CirPy receives PIN writes and this ACK works)
2. **MSG write** → log all incoming data for analysis; parse ShiftComplete if present for gear tracking

> **⚠️ Hub→pod writes are partially unverified.** PIN writes from the hub are confirmed (CirPy's `pin_buf` receives data). MSG writes from the hub have **never been directly observed** — we don't know if the hub writes ShiftComplete (or anything else) to the pod's MSG characteristic. The code below logs all incoming MSG writes so we can finally answer this question.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Handle PIN exchange**

In the GATT event handler, respond to PIN writes:

```rust
            BikeNetServiceEvent::PinWrite(data) => {
                log::info!("← PIN write: {:02X?}", data);
                // ACK with PIN_ACK — matches real pod behaviour
                const PIN_ACK: &[u8] = &[0x01];
                if let Err(e) = server.bikenet.pin_notify(&conn, PIN_ACK) {
                    log::warn!("PIN ACK failed: {:?}", e);
                }
            }
```

- [ ] **Step 2: Handle ShiftComplete and log MSG writes**

Add gear tracking state and handle MSG writes. **Log all MSG writes** — this is the first time we'll see what (if anything) the hub sends to the pod:

```rust
use core::sync::atomic::AtomicU8;

const NUM_GEARS: u8 = 12;
static CURRENT_GEAR: AtomicU8 = AtomicU8::new(0);

// In the GATT event handler:
            BikeNetServiceEvent::MsgWrite(data) => {
                // Log ALL incoming MSG writes — this will reveal what the hub
                // actually sends to the pod (previously unknown, see OBSERVED-BEHAVIOR.md).
                log::info!("← MSG write ({} bytes): {:02X?}", data.len(), data);

                if let Some(sc) = protocol::parse_shift_complete(&data) {
                    // ShiftComplete received! This confirms the hub writes it to the pod.
                    // gear field is 0-indexed (0 = gearPosition 1, 11 = gearPosition 12).
                    log::info!("ShiftComplete: gear_index={} (gearPosition={})", sc.gear, sc.gear + 1);
                    CURRENT_GEAR.store(sc.gear, Ordering::Relaxed);
                } else {
                    log::info!("MSG opcode: 0x{:02X}{:02X} (not ShiftComplete)",
                        data.get(1).unwrap_or(&0), data.get(0).unwrap_or(&0));
                }
            }
```

- [ ] **Step 3: Flash and verify — discover hub→pod communication**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

Full test sequence:
1. `hub add-device` → pod connects
2. `hub write-button-map --use-captured` → button map installed
3. Send `u` or `d` over serial → hub should shift
4. **Watch USB serial output carefully.** Look for `← MSG write` lines:
   - If you see frames starting with `03 40` → **the hub DOES write ShiftComplete to the pod!** Update `documents/OBSERVED-BEHAVIOR.md` with the finding.
   - If you see other opcodes → document them (hub→pod init sequence?)
   - If you see NO `← MSG write` lines → **the hub does NOT write to the pod's MSG char.** Note this in OBSERVED-BEHAVIOR.md.
5. Keep shifting → gear tracking should update in the serial log

> **This is the key discovery step.** Whether the hub writes to the pod has been an open question since the project started. USB serial logging finally lets us answer it.

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(firmware): PIN exchange + ShiftComplete gear tracking"
```

---

## Task 9: LED Status ⛔ BLOCKED

**Goal:** LED indicates pod state:
- **Solid on** = advertising (waiting for hub — shows pod is alive)
- **Off** = connected (save power — you know it works because shifts happen)
- **Blink** = button press / events

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Add LED control**

Add an LED task that responds to state changes:

```rust
use core::sync::atomic::AtomicU8;

const LED_OFF: u8 = 0;
const LED_ON: u8 = 1;
const LED_BLINK: u8 = 2;

static LED_STATE: AtomicU8 = AtomicU8::new(LED_OFF);

#[embassy_executor::task]
async fn led_task(pin: AnyPin) {
    let mut led = Output::new(pin, Level::Low, OutputDrive::Standard);

    loop {
        match LED_STATE.load(Ordering::Relaxed) {
            LED_ON => {
                led.set_high();
                Timer::after_millis(100).await;
            }
            LED_BLINK => {
                led.set_high();
                Timer::after_millis(80).await;
                led.set_low();
                Timer::after_millis(80).await;
                // After one blink cycle, revert to off (connected state)
                LED_STATE.store(LED_OFF, Ordering::Relaxed);
            }
            _ => {
                led.set_low();
                Timer::after_millis(100).await;
            }
        }
    }
}
```

- [ ] **Step 2: Set LED state at connection/disconnection/button events**

In `main()`, spawn the LED task:
```rust
    _spawner.spawn(led_task(p.P0_15.degrade())).unwrap();
```

Set state in the main loop:
```rust
    // Before advertising loop:
    LED_STATE.store(LED_ON, Ordering::Relaxed); // visible while searching for hub

    // After connection established:
    LED_STATE.store(LED_OFF, Ordering::Relaxed); // save power — shifts confirm it works

    // On button press (in button event handler):
    LED_STATE.store(LED_BLINK, Ordering::Relaxed);

    // After disconnect:
    LED_STATE.store(LED_ON, Ordering::Relaxed); // back to advertising
```

- [ ] **Step 3: Flash and verify**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

Verify: LED solid while advertising → off when hub connects → blinks on button press → solid again after disconnect.

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(firmware): LED status indicator"
```

---

## Task 10: Spurious Button-0 Release on Connect ⛔ BLOCKED

**Goal:** ~~The real pod sends a Release of buttonId 0x00 immediately after connecting (observed in hub monitor traces). Replicate this for compatibility.~~

> **⚠️ SKIP unless needed.** This was observed in hub monitor traces but may be an artifact of the real pod's boot sequence rather than a protocol requirement. Do not implement unless we discover the hub actually expects or requires this frame. If pairing or button-map writes fail without it, revisit.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Send spurious release after connection**

Right after the hub connects and the GATT server starts, send a battery report and the button-0 release:

```rust
        // Immediate battery report on connect (matches real pod behaviour)
        // Wait briefly for CCCD subscription
        Timer::after_millis(200).await;
        let battery_frame = protocol::encode_battery(&mac_le, /* current_mv */);
        let _ = server.bikenet.msg_notify(&conn, &battery_frame);

        // Spurious button-0 release (real pod quirk — replicate for compatibility)
        const SPURIOUS_BTN_ID: u8 = 0x00;
        let release_frame = protocol::encode_button(&mac_le, SPURIOUS_BTN_ID, protocol::ACTION_RELEASE);
        let _ = server.bikenet.msg_notify(&conn, &release_frame);
```

- [ ] **Step 2: Verify with hub monitor**

```powershell
npm run cli -- hub monitor --address d7:ba:ab:52:a0:e5
```

You should see `battery-voltage` followed by a `button-action` (buttonId=0, Release) immediately after connect — matching the real pod trace from the plan docs.

- [ ] **Step 3: Commit**

```powershell
git commit -am "feat(firmware): spurious button-0 release on connect"
```

---

## Task 11: Power Optimisation ⛔ BLOCKED

**Goal:** Ensure the firmware uses DCDC mode for efficient power regulation. Embassy + trouble/nrf-sdc already sleeps between events — this task just enables the hardware optimisation.

**Files:**
- Modify: `open-elin-firmware-rust/src/main.rs`

- [ ] **Step 1: Enable DCDC regulator**

In the Embassy nRF init config, enable the DCDC converter (more efficient than default LDO):

```rust
    let mut config = embassy_nrf::config::Config::default();
    config.dcdc.reg0 = true; // Use DCDC for VDD (saves ~3-4mA vs LDO)
    let p = embassy_nrf::init(config);
```

- [ ] **Step 2: Verify release profile**

The `[profile.release]` section was already added in Task 0. Confirm it's present:

```toml
[profile.release]
opt-level = "s"
lto = true
```

- [ ] **Step 3: Flash and verify**

```powershell
cd open-elin-firmware-rust
.\flash.ps1
```

Firmware should behave identically — DCDC mode is invisible to the application. If the board crashes on boot after enabling DCDC, the SuperMini may lack the required inductor (unlikely but possible on some clones) — revert and use LDO.

- [ ] **Step 4: Commit**

```powershell
git commit -am "feat(firmware): enable DCDC regulator for power efficiency"
```

---

## Summary — Feature Parity Checklist

| Feature | CirPy | Rust (after this plan) | Verified? |
|---------|-------|----------------------|-----------|
| BLE advertising as "NXS MTB Pod" | ✅ | Task 4 | ✅ observed via nRF Connect + hub scan |
| GATT service (MSG + PIN, write+notify) | ✅ | Task 5 | ✅ confirmed via nRF Connect |
| Button press/release → notification (3 buttons) | ✅ | Task 6 | ✅ observed on hub monitor |
| Battery voltage → periodic notification | ✅ | Task 7 | ✅ observed on hub monitor |
| PIN exchange (ACK 0x01) | ✅ | Task 8 | ✅ CirPy receives PIN writes, ACK works |
| ShiftComplete parsing + gear tracking | ✅ | Task 8 | ⚠️ **unverified** — hub→pod write never confirmed (see below) |
| Spurious button-0 release on connect | ✅ | Task 10 | ✅ observed on hub monitor |
| LED status (off/on/blink) | ✅ | Task 9 | ✅ visually confirmed |
| USB serial debug output | ✅ (USB CDC) | ✅ USB CDC via embassy-usb (Task 1) | ✅ |
| Serial command `b` → enter bootloader | — | ✅ Task 1 (enables hands-free flashing) | n/a (new feature) |
| Serial button triggers (`u`/`d`/`t`) | — | ✅ Task 6 (no physical buttons yet) | n/a (new feature) |
| Low-power sleep | ❌ (polling loop) | ✅ Task 11 (async `wfe`) | n/a (new feature) |
| Flash via USB (no debug probe) | ✅ (UF2) | ✅ UF2 (preserved bootloader) | ✅ |
| **Hub→pod MSG writes (discovery)** | ❓ never captured | Task 8 logs all incoming writes | ⚠️ **Task 8 will answer this** |

> **ShiftComplete verification status:** ShiftComplete (opcode `0x4003`) was observed as a **hub→app notification** on the hub's MSG characteristic (`targetMac = hub MAC`). Whether the hub also writes it to the **pod's** MSG characteristic is unknown — the CirPy code includes a parser for it, but it was **never confirmed to fire**. With 3 separate buttons (up/down/tune), direction-cycling is not needed — ShiftComplete is purely for gear tracking. Task 8 Step 3 is designed to finally answer whether the hub writes to the pod.

**Serial commands:** `b` (enter bootloader), `u` (shift up), `d` (shift down), `t` (tune). Physical GPIO buttons reserved for future wiring.

---

## Rust Survival Guide for JS/TS Developers

Quick mental model translations:

| JS/TS | Rust | Notes |
|-------|------|-------|
| `const x = 5` | `let x = 5` | Immutable by default in Rust |
| `let x = 5` | `let mut x = 5` | Mutable requires explicit `mut` |
| `string` | `&str` or `&[u8]` | No heap strings in `no_std` — byte slices everywhere |
| `Array<number>` | `[u8; 10]` | Fixed-size arrays, size known at compile time |
| `async/await` | `async/await` | Same keywords! Embassy makes this feel familiar |
| `console.log()` | `log::info!()` | Macro (note the `!`), output goes to USB serial |
| `null`/`undefined` | `Option<T>` | `Some(value)` or `None` — must be handled explicitly |
| `try/catch` | `Result<T, E>` | `Ok(value)` or `Err(e)` — `?` operator is like auto-throw |
| npm | cargo | `cargo build`, `cargo test`, `cargo run` |
| `package.json` | `Cargo.toml` | Same idea, TOML format |

**The one thing that will trip you up:** ownership and borrowing. When the compiler says "value moved here" or "borrow checker", it means you tried to use a value after giving it to something else. The fix is usually adding `&` (borrow instead of move) or `.clone()` (copy the data). Embassy's `'static` lifetime requirements for tasks make this more visible — `StaticCell` is the standard workaround.

---

## Appendix: Ideas to Try Later

Things that aren't part of the main plan but worth revisiting after the firmware is working.

### Power measurement with USB power monitor

Build a no-USB-serial variant and measure real consumption with the USB power monitor:

1. Add a Cargo feature flag to disable USB serial:
   ```toml
   [features]
   default = ["usb-serial"]
   usb-serial = ["embassy-usb", "embassy-usb-logger"]
   ```
2. Build without USB: `cargo build --release --no-default-features`
3. Flash the no-USB build (requires manual bootloader entry — short RST to GND twice, since there's no serial `b` command without USB)
4. Plug in via USB power monitor — board is powered via VBUS but USBD peripheral stays off
5. Observe: advertising idle, connected idle, button-press spikes
6. To return to normal: short RST to GND twice → flash normal build via `.\flash.ps1 -NoSerial`

Expected readings (nRF52840 + trouble/nrf-sdc + DCDC):
- Advertising: ~10–30 µA average
- Connected idle: ~15–40 µA average
- Button press: brief spike to ~5 mA

### Physical GPIO buttons

Wire real buttons to the reserved GPIO pins (P0.17, P0.20, P0.22) with active-low + internal pull-up. Add an Embassy GPIO task with async edge detection + debounce alongside the serial trigger.

### Nordic PPK2

If USB power monitor resolution isn't enough (~1mA granularity), get a Nordic PPK2 (~$50) for µA-resolution real-time profiling.
