# Battery Monitoring Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chatty 5-second battery polling with a power-efficient strategy: silent background checks every 15 minutes, PWM LED brightness on wake press to indicate battery level, and battery frame sent to hub only on connect and on demand.

**Architecture:** The periodic timer becomes a silent background ADC read (no BLE/NUS output). The LED gains a PWM driver for variable brightness. The pair button's wake action reads battery and flashes the LED at brightness proportional to voltage. The `v` serial/NUS command and on-connect battery report remain unchanged.

**Tech Stack:** Zephyr 4.4.x, nRF52840 hardware PWM (`&pwm0`), SAADC VDDHDIV5

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `open-elin-firmware-c/prj.conf` | Modify | Add `CONFIG_PWM=y` |
| `open-elin-firmware-c/boards/adafruit_feather_nrf52840.overlay` | Modify | Add PWM0 node for LED pin P0.15 |
| `open-elin-firmware-c/src/main.c` | Modify | Replace periodic handler, add PWM LED functions, modify wake handler, add sim battery commands |
| `open-elin-firmware-c/serial-buttons.ps1` | Modify | Add digit keys 0-9 for simulated battery levels |

---

### Task 1: Add PWM to device tree and Kconfig

**Files:**
- Modify: `open-elin-firmware-c/prj.conf`
- Modify: `open-elin-firmware-c/boards/adafruit_feather_nrf52840.overlay`

- [✅] **Step 1: Add PWM Kconfig**

In `prj.conf`, add after the `CONFIG_ADC=y` line:

```
# PWM (battery-level LED brightness)
CONFIG_PWM=y
```

- [✅] **Step 2: Add PWM0 node and pwm-led to overlay**

In `adafruit_feather_nrf52840.overlay`, add a `&pwm0` node and a `pwm-leds` node. The existing `gpio-leds` node stays (used for simple on/off blinks). Add before the `&qspi` section:

```dts
/* PWM for battery-level LED brightness indication */
&pwm0 {
    status = "okay";
    pinctrl-0 = <&pwm0_default>;
    pinctrl-1 = <&pwm0_sleep>;
    pinctrl-names = "default", "sleep";
};

&pinctrl {
    pwm0_default: pwm0_default {
        group1 {
            psels = <NRF_PSEL(PWM_OUT0, 0, 15)>;
        };
    };
    pwm0_sleep: pwm0_sleep {
        group1 {
            psels = <NRF_PSEL(PWM_OUT0, 0, 15)>;
            low-power-enable;
        };
    };
};
```

Also add to the root `/` block, inside the existing block that has `zephyr,user`:

```dts
    pwmleds {
        compatible = "pwm-leds";
        pwm_led0: pwm_led_0 {
            pwms = <&pwm0 0 PWM_MSEC(20) PWM_POLARITY_NORMAL>;
        };
    };
```

And add the include at the top of the overlay (after the ADC include):

```dts
#include <zephyr/dt-bindings/pwm/pwm.h>
```

- [✅] **Step 3: Build to verify PWM compiles**

Run: `.\open-elin-firmware-c\build.ps1`
Expected: Build succeeds (258/258 or similar), firmware.uf2 written.

- [✅] **Step 4: Commit**

```powershell
git add open-elin-firmware-c/prj.conf open-elin-firmware-c/boards/adafruit_feather_nrf52840.overlay
git commit -m "feat(firmware): add PWM device tree for battery LED brightness"
```

---

### Task 2: Add PWM LED flash function

**Files:**
- Modify: `open-elin-firmware-c/src/main.c`

- [✅] **Step 1: Add PWM include and device spec**

At the top of `main.c`, add after the `#include <zephyr/drivers/adc.h>` line:

```c
#include <zephyr/drivers/pwm.h>
```

After the `LED0_NODE` / `led` GPIO spec block (around line 20-21), add:

```c
static const struct pwm_dt_spec pwm_led = PWM_DT_SPEC_GET(DT_NODELABEL(pwm_led0));
```

- [✅] **Step 2: Add battery-brightness flash function**

After the existing `led_blink()` function (around line 300), add:

```c
/* PWM flash: brightness proportional to battery voltage.
 * 4200mV = 100% duty, 3000mV = 0% duty, clamped. */
static void led_off_pwm_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(led_off_pwm_work, led_off_pwm_work_handler);

static void led_off_pwm_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    pwm_set_pulse_dt(&pwm_led, 0);
}

static void led_battery_flash(int32_t mv)
{
    /* Clamp to 3000–4200mV range */
    if (mv < 3000) { mv = 3000; }
    if (mv > 4200) { mv = 4200; }

    /* Map to duty cycle: 3000=5%, 4200=100% (never fully off — confirms button worked) */
    uint32_t pct = 5 + (uint32_t)(mv - 3000) * 95 / 1200;
    uint32_t pulse = pwm_led.period * pct / 100;

    pwm_set_pulse_dt(&pwm_led, pulse);
    k_work_schedule(&led_off_pwm_work, K_MSEC(400));
}
```

- [✅] **Step 3: Build to verify it compiles**

Run: `.\open-elin-firmware-c\build.ps1`
Expected: Build succeeds.

- [✅] **Step 4: Commit**

```powershell
git add open-elin-firmware-c/src/main.c
git commit -m "feat(firmware): add PWM battery-brightness LED flash function"
```

---

### Task 3: Change periodic timer from 5s chatty to 15min silent

**Files:**
- Modify: `open-elin-firmware-c/src/main.c`

- [✅] **Step 1: Make battery_work_handler silent**

Replace the current `battery_work_handler` (around line 678):

```c
/*── Battery timer (every 5s) ──*/
static void battery_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    battery_mv = read_battery_mv();
    NUS_LOG("Battery: %d mV%s", battery_mv, usb_active ? " (USB)" : "");
    send_battery();
}
```

With:

```c
/*── Battery background check (every 15min, silent) ──*/
static void battery_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    battery_mv = read_battery_mv();
}
```

- [✅] **Step 2: Change timer interval from 5s to 15min**

In `main()`, replace:

```c
    /* Battery report every 5s via timer (runs in ISR context) */
    k_timer_start(&periodic_timer, K_SECONDS(5), K_SECONDS(5));
```

With:

```c
    /* Silent battery check every 15min (updates cached battery_mv) */
    k_timer_start(&periodic_timer, K_MINUTES(15), K_MINUTES(15));
```

- [✅] **Step 3: Update the cached comment**

Replace the comment above `battery_mv` (around line 63):

```c
/* Cached reading (updated every 5s from work queue) */
```

With:

```c
/* Cached reading (updated every 15min, on connect, and on 'v' command) */
```

- [✅] **Step 4: Build to verify**

Run: `.\open-elin-firmware-c\build.ps1`
Expected: Build succeeds.

- [✅] **Step 5: Commit**

```powershell
git add open-elin-firmware-c/src/main.c
git commit -m "feat(firmware): change battery poll from 5s chatty to 15min silent"
```

---

### Task 4: Wire wake button to battery flash + report

**Files:**
- Modify: `open-elin-firmware-c/src/main.c`

- [✅] **Step 1: Add PWM device ready check in main()**

In `main()`, after `battery_init()` (around line 706), add:

```c
    if (!pwm_is_ready_dt(&pwm_led)) {
        LOG_ERR("PWM LED not ready");
    }
```

- [✅] **Step 2: Modify btn_pair_work_handler to flash battery on wake**

Replace the current wake logic in `btn_pair_work_handler` (the button-pressed branch):

```c
        /* Button pressed — wake radio if sleeping, start 6s hold timer for pairing */
        if (radio_sleeping) {
            radio_wake();
        }
        k_work_schedule(&btn_pair_hold_work, K_SECONDS(6));
```

With:

```c
        /* Button pressed — wake radio, flash battery level, start 6s hold timer */
        if (radio_sleeping) {
            radio_wake();
        }
        /* Fresh battery read + PWM brightness flash */
        battery_mv = read_battery_mv();
        led_battery_flash(battery_mv);
        NUS_LOG("Battery: %d mV%s", battery_mv, usb_active ? " (USB)" : "");
        /* Send battery to hub if connected */
        if (current_conn) {
            send_battery();
        }
        k_work_schedule(&btn_pair_hold_work, K_SECONDS(6));
```

- [✅] **Step 3: Add simulated battery serial command (digits 0–9)**

In `handle_command()`, add before the `} else if (ch == '?')` branch:

```c
    } else if (ch >= '0' && ch <= '9') {
        /* Simulate battery level: 0=3000mV(dead) .. 9=4200mV(full) */
        int32_t sim_mv = 3000 + (ch - '0') * 1200 / 9;
        battery_mv = sim_mv;
        led_battery_flash(sim_mv);
        NUS_LOG("Sim battery: %d mV (key %c)", sim_mv, ch);
```

- [✅] **Step 4: Update help banner with sim battery keys**

In `print_help()`, replace the serial printk:

```c
    printk("\033[1;33mCommands:\033[0m "
           "\033[1mu\033[0m=up \033[1md\033[0m=down \033[1mt\033[0m=tune\n"
           "         \033[1mp\033[0m=wake \033[1mP\033[0m=pair \033[1mB\033[0m=boot "
           "\033[1mS\033[0m=sleep\n"
           "         \033[1mL\033[0m=latency \033[1mv\033[0m=battery "
           "\033[1m?\033[0m=help\n");
```

With:

```c
    printk("\033[1;33mCommands:\033[0m "
           "\033[1mu\033[0m=up \033[1md\033[0m=down \033[1mt\033[0m=tune\n"
           "         \033[1mp\033[0m=wake \033[1mP\033[0m=pair \033[1mB\033[0m=boot "
           "\033[1mS\033[0m=sleep\n"
           "         \033[1mL\033[0m=latency \033[1mv\033[0m=battery "
           "\033[1m0-9\033[0m=sim bat "
           "\033[1m?\033[0m=help\n");
```

Also update the NUS help text to mention `0-9=sim`.

- [✅] **Step 5: Update serial-buttons.ps1**

In `serial-buttons.ps1`, add digit handling to the `Show-Banner` function — add a line:

```powershell
    Write-Host "  0-9 = Sim Battery (0=dead 5=mid 9=full)    v = Read Battery" -ForegroundColor Cyan
```

And add to the switch block, after the `'B'` case:

```powershell
                { $_ -match '[0-9]' } { $serial.Write([string]$key); Write-Host "-> Sim Battery level $key" -ForegroundColor Cyan }
```

- [✅] **Step 6: Build to verify**

Run: `.\open-elin-firmware-c\build.ps1`
Expected: Build succeeds.

- [✅] **Step 7: Commit**

```powershell
git add open-elin-firmware-c/src/main.c open-elin-firmware-c/serial-buttons.ps1
git commit -m "feat(firmware): add 0-9 simulated battery commands for testing"
```

---

### Task 5: Flash, test, and verify

- [✅] **Step 1: Flash firmware**

Run: `.\open-elin-firmware-c\flash.ps1`
Expected: firmware.uf2 copied to UF2 drive, device reboots.

- [✅] **Step 2: Verify serial output**

Connect serial console (`serial-buttons.ps1`). Expected on boot:
- Help banner prints (ANSI colored), includes `0-9=sim bat`
- **No** periodic battery log every 5s (old behavior gone)

- [✅] **Step 3: Test simulated battery levels**

Use `serial-buttons.ps1` to send digit keys:
- Press `0`: LED barely visible (dim flash), log shows `Sim battery: 3000 mV (key 0)`
- Press `5`: LED medium brightness, log shows `Sim battery: 3666 mV (key 5)`
- Press `9`: LED full brightness, log shows `Sim battery: 4200 mV (key 9)`
- Each press produces a ~400ms LED flash then off

- [ ] **Step 4: Test wake button** *(manual — press pair button)*

Press pair button (short press). Expected:
- LED flashes at brightness proportional to battery voltage
- NUS log: `Battery: XXXX mV` (if NUS subscribed)

- [✅] **Step 5: Test `v` command**

Send `v` over serial or NUS. Expected:
- `Battery: XXXX mV` or `Battery: XXXX mV (USB)` logged
- No LED flash (only wake button and sim digits do PWM flash)

- [ ] **Step 6: Test on-connect battery report** *(manual — connect hub)*

Connect hub to pod over BLE. Expected:
- Battery frame sent on security_changed (existing behavior, unchanged)

- [ ] **Step 7: Commit final state**

```powershell
git add -A
git commit -m "feat(firmware): battery monitoring strategy complete

- 15min silent background ADC check (was 5s chatty)
- PWM LED flash on wake: brightness = battery level
- Battery frame sent on BLE connect and on demand
- 'v' command for instant serial/NUS readout"
```
