# Advertising Timeout + Shift Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop BLE advertising after prolonged inactivity (no hub connection) to save power. Wake on button press, queue the shift, and send it once the hub reconnects. No lost clicks.

**Architecture:** A single inactivity timer (`k_timer`) runs while advertising. If no hub connects within N minutes, advertising stops and a `radio_sleeping` flag is set. Button ISRs check this flag — if sleeping, they queue the shift and restart advertising via a work item. On hub connect, any queued shifts are flushed. The MCU remains in idle (~2-3 µA) while radio-off vs ~15-50 µA while advertising.

**Tech Stack:** Zephyr RTOS (k_timer, k_work, atomic flags), existing main.c

**Key design decisions:**
- Timeout: 15 minutes (configurable `#define`)
- Queue depth: 1 shift (last button press wins — simple, no ring buffer needed)
- Wake advertising runs for 60 seconds max. If hub doesn't connect, go back to sleep.
- Timer resets on every hub connect AND disconnect (hub disconnect → re-advertising → timer restarts)

---

## File Structure

```
firmware-pod/
└── src/
    └── main.c    # All changes in this file (self-contained feature)
```

---

## Task 1: Add radio sleep state and inactivity timer

**Files:**
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add state variables and timer declaration**

After the existing `static volatile bool usb_active;` block, add:

```c
/*── Radio sleep (advertising timeout) ──*/
#define ADV_TIMEOUT_MIN       15    /* Stop advertising after this many minutes idle */
#define ADV_WAKE_TIMEOUT_SEC  60    /* After wake, stop again if hub doesn't connect */

static volatile bool radio_sleeping;  /* true = advertising stopped to save power */

/* Pending shift — btn_id to send once hub connects (0xFF = none) */
static uint8_t pending_shift = 0xFF;

static void adv_timeout_handler(struct k_timer *timer);
static K_TIMER_DEFINE(adv_timeout_timer, adv_timeout_handler, NULL);
```

- [✅] **Step 2: Implement adv_timeout_handler — stops advertising**

```c
static void adv_timeout_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    if (current_conn) {
        return;  /* Don't sleep while connected */
    }
    bt_le_adv_stop();
    radio_sleeping = true;
    NUS_LOG("Radio sleep (no hub for %d min)", ADV_TIMEOUT_MIN);
}
```

- [✅] **Step 3: Implement pending shift helpers**

```c
static void pending_shift_set(uint8_t btn_id)
{
    pending_shift = btn_id;  /* Last press wins */
}

static void pending_shift_flush(void)
{
    if (pending_shift != 0xFF) {
        uint8_t btn_id = pending_shift;
        pending_shift = 0xFF;
        send_press_release(btn_id);
    }
}
```

- [✅] **Step 4: Implement radio_wake — restarts advertising with short timeout**

```c
static void radio_wake(void)
{
    if (!radio_sleeping) {
        return;
    }
    radio_sleeping = false;
    start_advertising();
    /* Give hub ADV_WAKE_TIMEOUT_SEC to connect, then sleep again */
    k_timer_start(&adv_timeout_timer, K_SECONDS(ADV_WAKE_TIMEOUT_SEC), K_NO_WAIT);
    NUS_LOG("Radio wake (button press)");
}
```

- [✅] **Step 5: Build to check for compile errors**

Run: `.\firmware-pod\build.ps1`
Expected: Compiles (functions defined but not yet called from anywhere useful)

- [✅] **Step 6: Commit skeleton**

```powershell
git add firmware-pod/src/main.c
git commit -m "feat(firmware): advertising timeout skeleton (timer, queue, wake)"
```

---

## Task 2: Wire up the timer and queue to existing logic

**Files:**
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Start inactivity timer when advertising begins**

In `start_advertising()`, after the success log, add:

```c
    /* Reset inactivity timer — hub has ADV_TIMEOUT_MIN to connect */
    k_timer_start(&adv_timeout_timer, K_MINUTES(ADV_TIMEOUT_MIN), K_NO_WAIT);
```

- [✅] **Step 2: Cancel timer and flush queue on hub connect**

In `connected()`, after `set_pairing_mode(false)`, add:

```c
    k_timer_stop(&adv_timeout_timer);
    radio_sleeping = false;
    pending_shift_flush();
```

- [✅] **Step 3: Modify button work handlers to check radio_sleeping**

In each of `btn_up_work_handler`, `btn_down_work_handler`, `btn_tune_work_handler`, replace the direct `send_press_release(BTN_X)` call with:

```c
    if (radio_sleeping || !current_conn) {
        pending_shift_set(BTN_SHIFT_UP);  /* or BTN_SHIFT_DOWN, BTN_TUNE */
        radio_wake();
    } else {
        send_press_release(BTN_SHIFT_UP);  /* or BTN_SHIFT_DOWN, BTN_TUNE */
    }
```

Note: `handle_command()` (serial/NUS) does NOT need this — if you have serial, the radio is already awake (USB = connected = hub likely nearby).

- [✅] **Step 4: Add serial 'S' command to force radio sleep**

In `handle_command()`, add a case for `'S'`:

```c
    } else if (ch == 'S') {
        if (current_conn) {
            NUS_LOG("Can't sleep while connected");
        } else {
            k_timer_stop(&adv_timeout_timer);
            bt_le_adv_stop();
            radio_sleeping = true;
            NUS_LOG("Radio sleep (forced)");
        }
    }
```

Also add `'S'` to the commands banner:

```c
    LOG_INF("Commands: u=up d=down t=tune p=pair S=sleep B=bootloader");
```

And update `serial-buttons.ps1` help text + key handler:

```powershell
Write-Host "  u = Shift Up    d = Shift Down    t = Tune    p = Pair    S = Sleep    B = Bootloader    q = Quit"
# ...
'S' { $serial.Write("S"); Write-Host "-> Radio Sleep" -ForegroundColor DarkYellow }
```

- [✅] **Step 4: Build**

Run: `.\firmware-pod\build.ps1`
Expected: Clean compile

- [✅] **Step 5: Commit**

```powershell
git add firmware-pod/src/main.c
git commit -m "feat(firmware): wire advertising timeout to connect/button handlers"
```

---

## Task 3: Test on hardware

- [✅] **Step 1: Flash and verify normal operation**

Flash firmware. Pair with hub. Send shifts via serial and GPIO buttons. Confirm everything works as before.

- [✅] **Step 2: E2E test: sleep → wake → shift delivered**

1. Put the **hub** to sleep (6s function button press on hub)
2. Press `S` in serial to force pod radio sleep — observe "Radio sleep (forced)"
3. Press a physical shift button on the pod — observe "Radio wake (button press)"
4. Wake the **hub** (function button press)
5. Hub should connect → observe "HUB CONNECTED" → queued shift is sent

This validates the full cycle: radio off → button press queues shift → advertising restarts → hub connects → shift delivered.

- [✅] **Step 3: Test natural timeout**

Change `ADV_TIMEOUT_MIN` to `1` (1 minute). Flash. Wait >1 minute without connecting the hub. Observe "Radio sleep (no hub for 1 min)". Then repeat step 2 (button press → wake → hub connects → shift sent).

- [✅] **Step 4: Test wake timeout (no hub available)**

Press `S` to sleep. Press a shift button to wake. Keep hub asleep. After 60 seconds, observe "Radio sleep" again (ADV_WAKE_TIMEOUT_SEC expired).

- [✅] **Step 5: Restore ADV_TIMEOUT_MIN to 15, rebuild, flash**

- [✅] **Step 6: Final commit**

```powershell
git add firmware-pod/src/main.c firmware-pod/serial-buttons.ps1
git commit -m "feat(firmware): advertising timeout 15min, verified on hardware"
```
