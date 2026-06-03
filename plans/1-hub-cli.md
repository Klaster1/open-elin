# Plan 1 — Hub CLI (`open-elin-cli`)

## Goal

A headless Node.js TypeScript CLI for driving the NXS BikeNet hub programmatically. Wraps the existing `demo-node` protocol/transport stack. Follows [Trevin Chow's 10 Principles for Agent-Native CLIs](https://x.com/trevin/status/2051316002730991795).

**Repo:** `c:\dev\nxs\cli`  
**Binary name:** `open-elin`  
**Node version:** 26.2.0 (pinned via `.node-version`)

---

## 10-Principle compliance map

| # | Principle | How we satisfy it |
|---|-----------|-------------------|
| 1 | Non-interactive by default | No prompts ever; TTY detection disables color/progress on non-TTY; all input via flags |
| 2 | Structured, parseable output | `--json` on every command; data → stdout; diagnostics → stderr; documented exit codes |
| 3 | Errors that teach and enumerate | Invalid MAC → show expected format; invalid command args → list valid values |
| 4 | Safe retries | BLE connect is retry-safe (disconnect + reconnect); read commands are idempotent |
| 5 | Bounded responses | `scan --limit=N`; `hub list` bounded by hub (max ~16 devices); truncation hints in JSON |
| 6 | Cross-CLI vocabulary | Verbs: `list`, `get`, `blink`; flags: `--json`, `--force`, `--limit`, `--timeout` |
| 7 | Three-layer introspection | `--help` on every command; `open-elin agent-context` returns versioned JSON schema; `SKILL.md` |
| 8 | Async-aware | BLE commands are sync from CLI POV (connect→cmd→disconnect inline); `hub monitor` streams events |
| 9 | Persistent identity | N/A — dropped; `--address` and `--pin` passed explicitly every time |
| 10 | Two-way I/O | `hub monitor --deliver=file:<path>` writes events to file; `feedback` command (stretch) |

---

## Command surface

```
open-elin scan [--timeout=<ms>] [--limit=N] [--json]
  Scan for BikeNet hubs. Returns array of {address, name, rssi}.

# --- device list ---
open-elin hub list [--json]
  Get paired device list from the hub (getList).
  Returns array of {mac, name, deviceId, isConnected, batteryVoltage, rssi}.

open-elin hub get <mac> [--json]
  Get single paired device entry from the hub's list by MAC.

# --- gear control ---
open-elin hub shift-up [--json]
  Send shiftUp command.

open-elin hub shift-down [--json]
  Send shiftDown command.

open-elin hub move <position> [--json]
  Absolute position move (0–6553.5). Sends absoluteMove.

open-elin hub get-position [--json]
  Read current absolute + gear position.

# --- rear cog ---
open-elin hub get-rear-cog [--json]
  Read rear cog cable positions and teeth counts.

open-elin hub set-rear-cog --positions=<csv> [--teeth=<csv>] [--json]
  Write rear cog calibration. Positions as comma-separated integers.

# --- button map ---
open-elin hub read-button-map [--json]
  Read raw button map bytes.

open-elin hub read-button-table [--json]
  Read decoded button table entries (waits for PeripheralCommand.ButtonTable notify).

# --- motor ---
open-elin hub get-motor-params [--json]
  Read motor parameters (stall detection, etc.).

# --- device info ---
open-elin hub set-name <name> [--target-mac=<mac>] [--json]
  Set the display name of a device. Optional --target-mac overrides hub's own MAC.

open-elin hub blink [--json]
  Blink the hub LED.

# --- streaming ---
open-elin hub monitor [--json] [--deliver=stdout|file:<path>]
  Subscribe to all hub notifications; stream one JSON event per line until Ctrl-C.
  Events: battery-voltage, button-action, shift-complete.

# --- introspection ---
open-elin agent-context
  Machine-readable CLI schema (versioned JSON). Consumed by agents for introspection.
```

### Global flags (on every command)

| Flag | Default | Description |
|------|---------|-------------|
| `--address=<mac>` | — | Hub MAC address (required for hub commands) |
| `--pin=<pin>` | `1111` | Hub PIN |
| `--timeout=<ms>` | `8000` | Scan/connect timeout |
| `--json` | false | Emit JSON to stdout |
| `--no-color` | auto | Disable ANSI (auto-disabled on non-TTY) |

### Exit code taxonomy

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General / unexpected error |
| 2 | Invalid arguments |
| 3 | BLE adapter unavailable |
| 4 | Hub not found (scan timeout) |
| 5 | Hub connection failed |
| 6 | Hub command failed (got error response) |

---

## Directory structure

```
cli/
  .node-version            ← "26.2.0"
  .gitignore
  package.json
  tsconfig.json
  SKILL.md                 ← agent skill manifest (layer 3 introspection)
  src/
    cli.ts                 ← optique `or(command(...))` root; global flags via `merge()`
    agent-context.ts       ← schema_version + full command/flag shape as JSON
    ble/
      transport-noble.ts   ← NobleTransport (BLE scan + connect via @abandonware/noble)
      connection.ts        ← openHub(address, pin, timeout) → {protocol, commands, device}
    commands/
      scan.ts
      hub/
        list.ts
        get.ts
        shift-up.ts
        shift-down.ts
        move.ts
        get-position.ts
        get-rear-cog.ts
        set-rear-cog.ts
        read-button-map.ts
        read-button-table.ts
        get-motor-params.ts
        set-name.ts
        blink.ts
        monitor.ts
    output.ts              ← printJson() / printTable() / printError() helpers
    exit-codes.ts          ← ExitCode enum
```

---

## Source reuse from demo-node

**No copying.** `open-elin-cli` is an npm workspace sibling of `demo-node` (root `c:\dev\nxs\package.json` declares both). `demo-node` exposes its source via `"exports": { "./src/*": "./src/*" }`. Imports in `open-elin-cli`:

```ts
import { parseGetListResponse, parseBatteryVoltageNotify } from "demo-node/src/commands.ts";
import { Protocol } from "demo-node/src/protocol.ts";
// NobleTransport now lives in cli/src/ble/transport-noble.ts
```

`node` runs `.ts` files natively in Node 26 (type stripping, no flag). No build step — `bin` points directly to `src/cli.ts`. Type-check with `tsc --noEmit`.

`NobleTransport` was moved from `demo-node/src/node/` into `cli/src/ble/transport-noble.ts`; `@abandonware/noble` was removed from `demo-node`. `src/ble/transport.ts` (thin re-export shim) was deleted as unnecessary.

---

## Key implementation notes

### Connection flow (per-command, stateless)
```
scan (8 s) → find address → connect → PIN unlock → execute command → disconnect
```
Every command does this inline. No persistent daemon. BLE scan is the slow part (~2–3 s);
total round-trip target ≤ 8 s.

### `hub monitor` — streaming mode
Stays connected; emits one JSON line per notification event on stdout. Exits on Ctrl-C (SIGINT)
or `--timeout`. Example output:
```json
{"event":"battery-voltage","mac":"aa:bb:cc:dd:ee:ff","mV":3810,"t":"2026-05-20T13:00:00.000Z"}
{"event":"button-action","mac":"aa:bb:cc:dd:ee:ff","buttonId":1,"label":"Up","t":"..."}
```

### `agent-context` output (layer 2 introspection)
```json
{
  "schema_version": "1",
  "binary": "open-elin",
  "commands": {
    "scan": { "flags": { "--timeout": {"type":"number","default":5000}, "--limit": {"type":"number"}, "--json": {"type":"bool"} } },
    "hub list": { "flags": { "--json": {"type":"bool"} } },
    ...
  },
  "exit_codes": { "0":"success", "3":"ble-unavailable", "4":"hub-not-found", ... }
}
```

---

## Implementation checklist

- [x] Scaffold: `package.json`, `tsconfig.json`, `.node-version`, `.gitignore`; install optique via `npx jsr add @optique/core @optique/run`
- [x] Wire npm workspaces (`c:\dev\nxs\package.json`) + `demo-node` exports field
- [x] `output.ts` helpers + `exit-codes.ts`
- [x] `scan` command
- [x] `ble/connection.ts` (connect + PIN unlock + disconnect wrapper)
- [x] `hub blink` command (simplest write command — smoke test for connection)
- [x] `hub list` / `hub get` commands
- [x] `hub shift-up` / `hub shift-down` / `hub move` / `hub get-position`
- [x] `hub get-rear-cog` / `hub set-rear-cog`
- [x] `hub read-button-map` / `hub read-button-table`
- [x] `hub get-motor-params` / `hub set-name`
- [x] `hub monitor` command
- [x] `agent-context` command
- [x] `SKILL.md`
- [x] End-to-end smoke test: scan → list → blink

---

## Success criteria

- ✅ `open-elin scan --json` → JSON array of hubs, exit 0; exit 4 if none found
- ✅ `open-elin hub list --address=<mac> --json` → paired device list JSON
- ✅ `open-elin hub blink --address=<mac> --json` → hub LED blinks, `{"ok":true}` returned
- ✅ `open-elin hub shift-down --address=<mac> --json` → `{"ok":true}`; `shift-up` returns exit 6 when hub is at gear 1 (0x8003 INVALID_STATE — correct hub-side rejection)
- ✅ `open-elin hub get-position --address=<mac> --json` → `{"absolutePosition":..., "gearPosition":...}`
- ✅ `open-elin hub get-rear-cog --address=<mac> --json` → cog calibration JSON
- ✅ `open-elin hub read-button-table --address=<mac> --json` → button map entries JSON
- ✅ `open-elin hub get-motor-params --address=<mac> --json` → motor params JSON
- ✅ `open-elin hub monitor --address=<mac> --json` → connects and streams; WinRT service-discovery hang fixed via retry logic in `NobleTransport.connect()` (8 s discover timeout → disconnect → 12 s wait → retry, up to 3 attempts)
- ✅ `open-elin agent-context` → valid JSON with `schema_version`
- ✅ All commands exit non-zero on error with message on stderr, nothing on stdout
