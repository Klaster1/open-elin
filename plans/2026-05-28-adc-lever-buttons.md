# ADC Lever Button Polling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [✅]`) syntax for tracking.

**Goal:** Replace GPIO edge interrupts for shift-up/down buttons with ADC polling so Di2 lever buttons work correctly on the SuperMini nRF52840.

**Architecture:** Add two ADC channels (AIN5 for up, AIN7 for down) to the device tree overlay. Remove GPIO interrupt setup for btn_up/btn_down. Add a 10ms polling timer that reads both ADC channels, applies a voltage threshold, debounces, and calls the existing `send_shift_or_queue()`. Bar-end buttons (pair/tune) remain GPIO interrupts — they work fine.

**Key finding during implementation:** Di2 lever buttons are **normally-open switches to GND**, NOT a resistor ladder as initially assumed. With internal pull-ups: idle = VDD (~2400mV), pressed = ~0mV. Threshold is inverted: `mv < 300` = pressed. Internal pull-ups via `nrf_gpio_cfg()` work — the Zephyr SAADC driver does NOT strip them on nRF52840 (only on nRF54 series).

**Tech Stack:** Zephyr RTOS, nRF52840 SAADC, C, device tree overlays

**Hardware state:** Up-button wire already moved from P0.17 to P0.29 (AIN5). Down-button wire stays on P0.31 (AIN7). Ground wire on GND.

---

### Task 1: Add ADC channels for lever buttons in device tree overlay

**Files:**
- Modify: `firmware-pod/boards/adafruit_feather_nrf52840.overlay`

The overlay already has `&adc` with channel@0 for battery (VDDHDIV5). We add channel@1 (AIN5 / P0.29 = up) and channel@2 (AIN7 / P0.31 = down). We also remove btn_up and btn_down from the `buttons` node (they're no longer GPIO) and update `zephyr,user` io-channels to list all three ADC channels.

- [✅] **Step 1: Update the overlay**

Replace the `buttons` block, `aliases` block, `zephyr,user` block, and `&adc` block:

```c
/* In the buttons node, remove btn_up and btn_down (now ADC, not GPIO) */
    buttons {
        compatible = "gpio-keys";
        btn_pair: button_2 {
            gpios = <&gpio0 20 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "Pair";
        };
        btn_tune: button_3 {
            gpios = <&gpio0 22 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "Tune";
        };
    };

    aliases {
        sw2 = &btn_pair;
        sw3 = &btn_tune;
    };
```

Update `zephyr,user` to expose all three ADC channels:

```c
    zephyr,user {
        io-channels = <&adc 0>, <&adc 1>, <&adc 2>;
    };
```

Add lever button ADC channels to `&adc`:

```c
&adc {
    status = "okay";
    #address-cells = <1>;
    #size-cells = <0>;
    channel@0 {
        reg = <0>;
        zephyr,gain = "ADC_GAIN_1_6";
        zephyr,reference = "ADC_REF_INTERNAL";
        zephyr,acquisition-time = <ADC_ACQ_TIME_DEFAULT>;
        zephyr,input-positive = <NRF_SAADC_VDDHDIV5>;
        zephyr,resolution = <12>;
    };
    /* Lever UP button — P0.29 / AIN5 */
    channel@1 {
        reg = <1>;
        zephyr,gain = "ADC_GAIN_1_4";
        zephyr,reference = "ADC_REF_INTERNAL";
        zephyr,acquisition-time = <ADC_ACQ_TIME(ADC_ACQ_TIME_MICROSECONDS, 10)>;
        zephyr,input-positive = <NRF_SAADC_AIN5>;
        zephyr,resolution = <12>;
    };
    /* Lever DOWN button — P0.31 / AIN7 */
    channel@2 {
        reg = <2>;
        zephyr,gain = "ADC_GAIN_1_4";
        zephyr,reference = "ADC_REF_INTERNAL";
        zephyr,acquisition-time = <ADC_ACQ_TIME(ADC_ACQ_TIME_MICROSECONDS, 10)>;
        zephyr,input-positive = <NRF_SAADC_AIN7>;
        zephyr,resolution = <12>;
    };
};
```

ADC gain `1/4` with internal reference (0.6V): full-scale = 0.6V × 4 = 2.4V. This comfortably covers the expected 0.7V (up) and 1.7V (down) voltage spikes without clipping, and gives good resolution in that range.

- [✅] **Step 2: Build to verify overlay compiles**

Run: `.\firmware-pod\build.ps1`
Expected: Build succeeds (no DTS errors)

- [✅] **Step 3: Commit**

```
git add firmware-pod/boards/adafruit_feather_nrf52840.overlay
git commit -m "dts: add ADC channels for lever buttons, remove shift GPIO pins"
```

---

### Task 2: Replace GPIO shift-button code with ADC polling in main.c

**Files:**
- Modify: `firmware-pod/src/main.c`

This is the main change. Remove all GPIO infrastructure for btn_up and btn_down (specs, callbacks, ISRs, work items). Add ADC channel specs for the two lever channels, a 10ms polling timer, threshold detection with debounce, and calls to `send_shift_or_queue()`.

- [✅] **Step 1: Remove GPIO shift-button declarations**

Remove these lines near the top of main.c:

```c
/* DELETE these — shift buttons are now ADC, not GPIO */
static const struct gpio_dt_spec btn_up = GPIO_DT_SPEC_GET(DT_ALIAS(sw0), gpios);   /* P0.17 */
static const struct gpio_dt_spec btn_down = GPIO_DT_SPEC_GET(DT_ALIAS(sw1), gpios); /* P0.31 */
static struct gpio_callback btn_up_cb_data;
static struct gpio_callback btn_down_cb_data;
```

- [✅] **Step 2: Add ADC lever channel declarations**

Add after the `adc_battery` declaration:

```c
/*── Lever button ADC channels ──*/
static const struct adc_dt_spec adc_lever_up =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 1);
static const struct adc_dt_spec adc_lever_down =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 2);

#define LEVER_THRESHOLD_MV  300   /* >300mV = button pressed */
#define LEVER_POLL_MS       10    /* poll every 10ms */
```

- [✅] **Step 3: Add lever ADC init to battery_init()**

Extend `battery_init()` to also set up the lever ADC channels:

```c
static int battery_init(void)
{
    if (!adc_is_ready_dt(&adc_battery)) {
        LOG_ERR("ADC device not ready");
        return -ENODEV;
    }
    int err = adc_channel_setup_dt(&adc_battery);
    if (err) {
        LOG_ERR("ADC channel setup failed: %d", err);
        return err;
    }
    LOG_INF("Battery ADC ready (VDDHDIV5 internal)");

    /* Lever button ADC channels */
    err = adc_channel_setup_dt(&adc_lever_up);
    if (err) {
        LOG_ERR("ADC lever-up setup failed: %d", err);
        return err;
    }
    err = adc_channel_setup_dt(&adc_lever_down);
    if (err) {
        LOG_ERR("ADC lever-down setup failed: %d", err);
        return err;
    }
    LOG_INF("Lever ADC ready (AIN5=up, AIN7=down)");
    return 0;
}
```

- [✅] **Step 4: Add lever read helper**

Add after `read_battery_mv()`:

```c
static int32_t read_lever_mv(const struct adc_dt_spec *spec)
{
    int16_t buf;
    struct adc_sequence seq = {
        .buffer = &buf,
        .buffer_size = sizeof(buf),
    };
    adc_sequence_init_dt(spec, &seq);
    int err = adc_read_dt(spec, &seq);
    if (err) {
        return -1;
    }
    int32_t mv = buf;
    adc_raw_to_millivolts_dt(spec, &mv);
    return mv;
}
```

- [✅] **Step 5: Add lever polling timer and work handler**

Replace the old `btn_up_isr`, `btn_down_isr`, `btn_up_work_handler`, `btn_down_work_handler`, and their K_WORK_DEFINE declarations with a single polling mechanism. Add this in the "GPIO button interrupts" section:

```c
/*── Lever button ADC polling ──*/
static bool lever_up_pressed;
static bool lever_down_pressed;

static void lever_poll_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    int32_t mv_up = read_lever_mv(&adc_lever_up);
    int32_t mv_down = read_lever_mv(&adc_lever_down);

    bool up_now = (mv_up > LEVER_THRESHOLD_MV);
    bool down_now = (mv_down > LEVER_THRESHOLD_MV);

    if (up_now && !lever_up_pressed) {
        lever_up_pressed = true;
        int64_t now = k_uptime_get();
        if (now - last_shift_ms >= DEBOUNCE_MS) {
            last_shift_ms = now;
            send_shift_or_queue(BTN_SHIFT_UP);
        }
    } else if (!up_now) {
        lever_up_pressed = false;
    }

    if (down_now && !lever_down_pressed) {
        lever_down_pressed = true;
        int64_t now = k_uptime_get();
        if (now - last_shift_ms >= DEBOUNCE_MS) {
            last_shift_ms = now;
            send_shift_or_queue(BTN_SHIFT_DOWN);
        }
    } else if (!down_now) {
        lever_down_pressed = false;
    }
}

static K_TIMER_DEFINE(lever_poll_timer, lever_poll_handler, NULL);
```

**Note:** `send_shift_or_queue` calls `send_press_release` which calls `k_msleep(50)`. This is fine from a timer handler in Zephyr since K_TIMER handlers run in system workqueue context by default — but actually, `k_msleep` cannot be called from an ISR or timer callback. We need to use a work item instead:

```c
/*── Lever button ADC polling ──*/
static bool lever_up_pressed;
static bool lever_down_pressed;

static void lever_poll_work_handler(struct k_work *work);
static K_WORK_DEFINE(lever_poll_work, lever_poll_work_handler);

static void lever_poll_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&lever_poll_work);
}

static K_TIMER_DEFINE(lever_poll_timer, lever_poll_timer_handler, NULL);

static void lever_poll_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int32_t mv_up = read_lever_mv(&adc_lever_up);
    int32_t mv_down = read_lever_mv(&adc_lever_down);

    bool up_now = (mv_up > LEVER_THRESHOLD_MV);
    bool down_now = (mv_down > LEVER_THRESHOLD_MV);

    if (up_now && !lever_up_pressed) {
        lever_up_pressed = true;
        int64_t now = k_uptime_get();
        if (now - last_shift_ms >= DEBOUNCE_MS) {
            last_shift_ms = now;
            send_shift_or_queue(BTN_SHIFT_UP);
        }
    } else if (!up_now) {
        lever_up_pressed = false;
    }

    if (down_now && !lever_down_pressed) {
        lever_down_pressed = true;
        int64_t now = k_uptime_get();
        if (now - last_shift_ms >= DEBOUNCE_MS) {
            last_shift_ms = now;
            send_shift_or_queue(BTN_SHIFT_DOWN);
        }
    } else if (!down_now) {
        lever_down_pressed = false;
    }
}
```

- [✅] **Step 6: Remove GPIO setup for shift buttons from main()**

In `main()`, remove these lines:

```c
/* DELETE — shift buttons are now ADC polled */
    gpio_pin_configure_dt(&btn_up, GPIO_INPUT);
    gpio_pin_configure_dt(&btn_down, GPIO_INPUT);
    gpio_pin_interrupt_configure_dt(&btn_up, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_pin_interrupt_configure_dt(&btn_down, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_init_callback(&btn_up_cb_data, btn_up_isr, BIT(btn_up.pin));
    gpio_init_callback(&btn_down_cb_data, btn_down_isr, BIT(btn_down.pin));
    gpio_add_callback(btn_up.port, &btn_up_cb_data);
    gpio_add_callback(btn_down.port, &btn_down_cb_data);
```

- [✅] **Step 7: Start lever poll timer in main()**

Add after the GPIO button setup and before `start_advertising()`:

```c
    /* Start lever ADC polling (10ms interval for Di2 resistor-ladder buttons) */
    k_timer_start(&lever_poll_timer, K_MSEC(LEVER_POLL_MS), K_MSEC(LEVER_POLL_MS));
    LOG_INF("Lever ADC polling: P0.29=up P0.31=down (%dms, >%dmV)",
            LEVER_POLL_MS, LEVER_THRESHOLD_MV);
```

- [✅] **Step 8: Update the GPIO log line**

Change:
```c
    LOG_INF("GPIO buttons: P0.17=up P0.31=down P0.20=pair P0.22=tune");
```
To:
```c
    LOG_INF("GPIO buttons: P0.20=pair P0.22=tune");
```

- [✅] **Step 9: Add ADC debug logging toggle**

Add a flag and print in the lever poll work handler:

```c
static bool lever_adc_debug;  /* toggle with 'a' serial command */
```

In `lever_poll_work_handler`, add at the top (after reading both channels):

```c
    if (lever_adc_debug) {
        printk("ADC up=%d dn=%d\n", (int)mv_up, (int)mv_down);
    }
```

In `handle_command()`, add before the `} else if (ch == '?')` branch:

```c
    } else if (ch == 'a') {
        lever_adc_debug = !lever_adc_debug;
        NUS_LOG("Lever ADC debug: %s", lever_adc_debug ? "ON (10ms)" : "OFF");
```

In `print_help()`, update the serial help string:

```c
    printk("\033[1;33mCommands:\033[0m "
           "\033[1mu\033[0m=up \033[1md\033[0m=down \033[1mt\033[0m=tune\n"
           "         \033[1mp\033[0m=wake \033[1mP\033[0m=pair \033[1mB\033[0m=boot "
           "\033[1mS\033[0m=sleep\n"
           "         \033[1mL\033[0m=latency \033[1mv\033[0m=battery "
           "\033[1m0-9\033[0m=sim bat\n"
           "         \033[1ma\033[0m=adc "
           "\033[1m?\033[0m=help\n");
```

Update the NUS (BLE) help strings:

```c
    if (gatt_nus_is_subscribed()) {
        gatt_nus_send("Commands: u=up d=down t=tune\n", 30);
        gatt_nus_send("p=wake P=pair B=boot S=sleep\n", 29);
        gatt_nus_send("L=latency v=bat 0-9=sim a=adc\n", 31);
        gatt_nus_send("?=help\n", 7);
    }
```

This prints mV readings at 10ms intervals while toggled on — press lever buttons and watch the actual voltage values scroll by. Use this to determine real thresholds before tuning `LEVER_THRESHOLD_MV`.

- [✅] **Step 10: Build**

Run: `.\firmware-pod\build.ps1`
Expected: Build succeeds

- [✅] **Step 10: Commit**

```
git add firmware-pod/src/main.c
git commit -m "feat: ADC polling for Di2 lever buttons, replace GPIO interrupts"
```

---

### Task 3: Flash and hardware test

- [✅] **Step 1: Flash firmware**

Run: `.\firmware-pod\flash.ps1`

- [✅] **Step 2: Verify serial output**

Connect via serial (`.\firmware-pod\serial-buttons.ps1`). Check boot log shows:
- `Lever ADC ready (AIN5=up, AIN7=down)`
- `Lever ADC polling: P0.29=up P0.31=down (10ms, >300mV)`
- `GPIO buttons: P0.20=pair P0.22=tune`

- [✅] **Step 3: Test serial commands still work**

Type `u`, `d`, `t` — should still send shift commands via serial path (unchanged).

- [✅] **Step 4: Test Di2 lever buttons**

Press up lever — should see `-> button 0x00` (one event, not two).
Press down lever — should see `-> button 0x01` (one event, not two).
Verify no crosstalk (pressing one button should NOT trigger the other).

- [✅] **Step 5: Test bar-end buttons still work**

Press pair button — should show battery level + wake radio.
Hold pair 6s — should enter pairing mode.
Press tune button — should send tune command.

- [✅] **Step 6: Test with hub connected**

Pair with hub, verify shifting works in both directions. Verify tune mode works.

- [✅] **Step 7: Characterize lever voltages with ADC debug**

Type `a` to enable continuous ADC logging. Press each lever button several times and record the voltage readings. Expected:
- Idle: near 0mV on both channels
- Up pressed: ~700mV on up channel (verify)
- Down pressed: ~1700mV on down channel (verify)

If actual values differ from multimeter readings, adjust `LEVER_THRESHOLD_MV` in main.c accordingly. The threshold should be well below the lowest button voltage but above idle noise.

Type `a` again to disable logging.

- [✅] **Step 8: Tune threshold if needed and commit**

If threshold adjustment was needed:
```
git add firmware-pod/src/main.c
git commit -m "tune: adjust lever ADC threshold based on measured voltages"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `documents/DI2-LEVER-BUTTONS.md`

- [✅] **Step 1: Update the "Correct approach" section**

Update the status from planned to implemented:

```markdown
## Implementation (SuperMini nRF52840)

**ADC polling** — implemented in firmware, replacing GPIO edge interrupts for shift buttons.

- Up-button wire on P0.29 (AIN5), ADC channel 1
- Down-button wire on P0.31 (AIN7), ADC channel 2
- Polled every 10ms via Zephyr timer → work queue
- Threshold: >300mV = pressed
- Debounce: 150ms shared timer (same as previous GPIO debounce)
- Bar-end buttons (pair P0.20, tune P0.22) remain GPIO interrupts

ADC gain: 1/4, internal 0.6V reference → full-scale 2.4V.
```

- [✅] **Step 2: Commit**

```
git add documents/DI2-LEVER-BUTTONS.md
git commit -m "docs: update Di2 lever doc with ADC implementation details"
```
