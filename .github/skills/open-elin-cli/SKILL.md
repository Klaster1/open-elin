---
name: open-elin-cli
description: 'Interact with an NXS BikeNet hub over BLE. Use when: running hub commands, scanning for hubs, shifting gears, reading/writing button maps, monitoring BLE events, or any NXS hardware interaction via CLI.'
---

# open-elin CLI

Use this skill when you need to interact with an NXS BikeNet hub over BLE
from any agent or automation context.

## Prerequisites

- Node.js ≥ 26.2.0  
- Windows / macOS / Linux with a BLE adapter supported by `@abandonware/noble`  
- Hub powered on and in range  
- Run `npm install` in the workspace root once  

## Invoking the CLI

From workspace root:

```
npm run cli -- <command> [flags]
```

Or directly:

```
node open-elin-cli/src/cli.ts <command> [flags]
```

## Key commands

| Command | Purpose |
|---|---|
| `scan` | Discover nearby hubs (returns address, name, RSSI) |
| `hub list` | List devices paired to a hub |
| `hub blink` | Blink hub LED (connection test) |
| `hub shift-up / shift-down` | Shift gear |
| `hub move <POS>` | Absolute position move (0–6553.5) |
| `hub get-position` | Read current position + gear |
| `hub get-rear-cog` | Read cog cable-position table |
| `hub set-rear-cog` | Write cog cable-position table |
| `hub read-button-map` | Raw button map bytes |
| `hub read-button-table` | Parsed button-table (waits notify) |
| `hub get-motor-params` | Motor parameter block |
| `hub set-name <NAME>` | Rename device |
| `hub monitor` | Stream BLE events as JSON lines |
| `agent-context` | Print full schema for agents |

## Common flags

| Flag | Default | Meaning |
|---|---|---|
| `--address=<MAC>` | required | Hub BLE MAC (any separator) |
| `--pin=<pin>` | `1111` | Unlock PIN |
| `--timeout=<ms>` | `5000` | Scan / connect timeout |
| `--json` | false | Machine-readable JSON output |

## Typical agent workflow

1. Run `open-elin agent-context` once to load the schema.
2. Run `open-elin scan --json` to discover hub addresses.
3. Run hub commands with `--address=<found MAC> --json`.
4. Parse JSON stdout; non-zero exit code = error.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | BLE adapter unavailable |
| 4 | Hub not found during scan |
| 5 | Connect failed |
| 6 | Command returned error status |
