# Connection Parameter Renegotiation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [✅]`) syntax for tracking.

**Goal:** Request wider BLE connection parameters (higher slave latency) after prolonged idle to reduce radio wakeups. Revert to tight parameters on button press for responsive shifting.

**Architecture:** A "latency escalation" timer runs while connected. 60 minutes after the last shift, the pod requests wider latency from the hub via `bt_conn_le_param_update()`. On the next button press, the pod requests original params back before sending. The hub may accept or reject — both cases must be handled gracefully.

**Tech Stack:** Zephyr BLE `bt_conn_le_param_update()`, k_timer

**Prerequisites:**
- ~~First determine if the hub stays connected long-term during normal riding~~ Hub stays connected continuously.
- Power savings estimate: ~2-4 µA (going from 660ms to 3060ms radio idle interval)

**Key design decisions:**
- Idle timeout before escalation: 60 minutes (bike parked scenario)
- Original params (hub-imposed): interval=40 (50ms), latency=0, timeout=42 (420ms)
- Normal params (pod-requested): interval=48 (60ms), latency=10 → 660ms effective
- Relaxed params (pod-requested): interval=48 (60ms), latency=50 → 3060ms effective
- Supervision timeout computed dynamically per BLE spec: `(1 + latency) * interval / 4 + 1`
- If hub rejects the update: log and continue — no retry, no error state
- On button press while relaxed: request original params, then send shift immediately (don't wait for param update ACK — shift will go out on next connection event regardless)
- Serial 'L' command: force latency escalation for testing (skip the 60-min wait)

**Hub latency limits (tested 2026-05-24):**
| Latency | Result |
|---------|--------|
| 30 | ✅ Accepted |
| 40 | ✅ Accepted |
| 50 | ✅ Accepted |
| 60 | ✅ Accepted |
| 70 | ❌ Disconnected |
| 100 | ❌ Disconnected |

Using latency=50 for safety margin.

---

## File Structure

```
firmware-pod/
└── src/
    └── main.c    # All changes in this file
```

---

## Task 1: Add latency state and escalation timer

**Files:**
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Add defines and state**

```c
/*── Connection parameter renegotiation ──*/
#define LATENCY_ESCALATION_MIN  60    /* Minutes idle before requesting wider latency */
#define LATENCY_NORMAL          10    /* Hub's default slave latency */
#define LATENCY_RELAXED         30    /* Wider latency for idle saving */
#define CONN_INTERVAL           48    /* 60ms — keep hub's interval unchanged */
#define CONN_SUPERVISION_TO     400   /* 4 seconds */

static bool latency_relaxed;  /* true = currently using wider latency */

static void latency_escalation_handler(struct k_timer *timer);
static K_TIMER_DEFINE(latency_timer, latency_escalation_handler, NULL);
```

- [✅] **Step 2: Implement escalation handler**

```c
static void latency_escalation_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    if (!current_conn || latency_relaxed) {
        return;
    }
    struct bt_le_conn_param param = BT_LE_CONN_PARAM_INIT(
        CONN_INTERVAL, CONN_INTERVAL, LATENCY_RELAXED, CONN_SUPERVISION_TO);
    int err = bt_conn_le_param_update(current_conn, &param);
    if (err) {
        NUS_LOG("Latency escalation request failed: %d", err);
    } else {
        latency_relaxed = true;
        NUS_LOG("Requested relaxed latency (%d)", LATENCY_RELAXED);
    }
}
```

- [✅] **Step 3: Implement de-escalation helper**

```c
static void latency_tighten(void)
{
    if (!current_conn || !latency_relaxed) {
        return;
    }
    struct bt_le_conn_param param = BT_LE_CONN_PARAM_INIT(
        CONN_INTERVAL, CONN_INTERVAL, LATENCY_NORMAL, CONN_SUPERVISION_TO);
    int err = bt_conn_le_param_update(current_conn, &param);
    if (err) {
        NUS_LOG("Latency tighten request failed: %d", err);
    } else {
        NUS_LOG("Requested normal latency (%d)", LATENCY_NORMAL);
    }
    latency_relaxed = false;
}
```

- [✅] **Step 4: Build to verify compile**

Run: `.\firmware-pod\build.ps1`
Expected: Clean compile (functions unused for now)

- [✅] **Step 5: Commit skeleton**

```powershell
git add firmware-pod/src/main.c
git commit -m "feat(firmware): connection param renegotiation skeleton"
```

---

## Task 2: Wire escalation to connection and button events

**Files:**
- Modify: `firmware-pod/src/main.c`

- [✅] **Step 1: Start escalation timer on connect**

In `connected()`, after the existing code:

```c
    /* Start latency escalation timer */
    latency_relaxed = false;
    k_timer_start(&latency_timer, K_MINUTES(LATENCY_ESCALATION_MIN), K_NO_WAIT);
```

- [✅] **Step 2: Stop timer on disconnect**

In `disconnected()`, before the advertising restart:

```c
    k_timer_stop(&latency_timer);
    latency_relaxed = false;
```

- [✅] **Step 3: Reset timer and tighten on shift**

In `send_press_release()`, at the top of the function:

```c
    latency_tighten();
    k_timer_start(&latency_timer, K_MINUTES(LATENCY_ESCALATION_MIN), K_NO_WAIT);
```

- [✅] **Step 4: Build**

Run: `.\firmware-pod\build.ps1`
Expected: Clean compile

- [✅] **Step 5: Commit**

```powershell
git add firmware-pod/src/main.c
git commit -m "feat(firmware): wire latency escalation to connect/shift events"
```

---

## Task 3: Hardware test

**Prerequisites:** Confirm hub stays connected for >20 minutes during normal use. If it doesn't, this feature is moot.

- [✅] **Step 1: Test with shortened timer (2 minutes)**

Temporarily change `LATENCY_ESCALATION_MIN` to `2`. Flash. Connect hub. Wait 2 minutes idle. Observe NUS log: "Requested relaxed latency (30)". Alternatively, use the `L` serial command to force escalation immediately.

- [✅] **Step 2: Test de-escalation on shift**

After escalation, press a button. Observe: "Requested normal latency (10)" followed by the shift.

- [✅] **Step 3: Verify hub accepts params**

Check that shifts still work after escalation and de-escalation. If the hub rejects (no security change, shifts still work), the feature is passive-safe.

- [✅] **Step 4: Restore timer to 60 minutes, rebuild, flash**

- [✅] **Step 5: Final commit**

```powershell
git add firmware-pod/src/main.c
git commit -m "feat(firmware): latency escalation 20min idle, verified"
```

---

## Notes

- Feature is implemented and verified. Hub accepts latency=50, rejects >=70.
- Worst case if hub rejects: one dropped connection, auto-recovers in ~1s.
- Dynamic supervision timeout calculation ensures BLE spec compliance for any latency value.
- `le_param_updated` callback logs actual negotiated params for diagnostics.
- Committed in f1fe136.
