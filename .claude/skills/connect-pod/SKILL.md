---
name: connect-pod
description: 'Connect an NXS pod to a hub and configure button mapping. Use when: pairing a pod, writing button maps, troubleshooting pod connection, setting up BikeNet, or verifying pod buttons trigger shifts.'
---

# Connect Pod

Pair an NXS pod to a hub and write the button map so physical button presses trigger shifts.

## Prerequisites

- Hub powered on and in range
- Pod powered on
- Hub MAC and pod MAC known (run `npm run cli -- scan --json` to discover)

## Procedure

### One-time setup (new hub or after factory reset only)

```
npm run cli -- hub set-bikenet --address <hub-mac>
```

> **WARNING**: `set-bikenet` resets ALL hub state including existing pod bonds. Do NOT run this if the pod is already paired — skip to step 1.

### Step 1 — Add pod to hub

```
npm run cli -- hub add-device --address <hub-mac> --timeout 15000 <pod-mac>
```

The hub scans for the pod by BLE local name `NXS MTB Pod` and bonds to it. Returns `0x8003` (INVALID_STATE) if already paired — this is benign, proceed to step 2.

### Step 2 — Verify connection

```
npm run cli -- hub list --address <hub-mac> --json
```

Pod should appear with connected status (`●`).

### Step 3 — Write button map

```
npm run cli -- hub write-default-button-map --address <hub-mac> --pod-mac <pod-mac>
```

This writes 7 button-map entries mapping pod button codes to shift/tune actions. **Without this the hub silently ignores all pod button presses.**

### Step 4 — Verify

Press a pod button — the derailleur should physically move.

## Button map reference

| Button code | Label | Function |
|-------------|-------|----------|
| `0x00` | - | Shift Up |
| `0x06` | B | Shift Down |
| `0x0C` | C | Tune Mode |
| `0x0D` | C-1 | Shift Up |
| `0x01` | A-1 | Shift Down |
| `0x12` | D | Shift Down |
| `0x02` | A-2 | Tune Mode |

## Troubleshooting

- **Buttons don't trigger shifts**: button map is empty — run step 3
- **`add-device` times out**: pod not advertising — power-cycle the pod, ensure it's not bonded to another hub
- **`INVALID_STATE` from `add-device`**: pod already in hub list — skip to step 2
