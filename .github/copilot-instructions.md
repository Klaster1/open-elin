# NXS Workspace — Copilot Instructions

## Project overview

Open-source replacement firmware and tools for the NXS BikeNet wireless electronic shifting system.

## Workspace structure

| Folder | Purpose |
|--------|---------|
| `open-elin-cli/` | Node.js CLI for controlling NXS hubs over BLE (TypeScript, ESM) |
| `open-elin-web/` | Lit-based web app for hub configuration via Web Bluetooth |
| `open-elin-pod-firmware/` | Replacement pod firmware docs and hardware reference |
| `open-elin-firmware-python/` | CircuitPython firmware prototype (copy to `E:\` to deploy to device) |
| `documents/` | Protocol specs, hardware maps, observed behavior notes |
| `plans/` | Implementation plans |
| `decompilation/` | APK decompilation sources (reference only, do not modify) |
| `data/` | BLE sniff captures and raw data |
| `prints/` | 3D print files (FreeCAD, 3MF) |
| `tools/` | Serial probing scripts, JADX, OpenOCD |

## Tech stack

- **CLI**: Node.js ≥ 26.2.0, TypeScript (strip types, no build step), ESM, `@abandonware/noble` for BLE
- **Web**: Lit, Vite, Shoelace, Web Bluetooth API, Playwright for E2E
- **Package manager**: npm workspaces (root `package.json`)

## Hardware MACs

| Device | MAC | Name |
|--------|-----|------|
| Hub | `D7:BA:AB:52:A0:E5` | NXS eLink hub |
| Pod (real) | `D5:89:B2:13:FA:04` | NXS MTB Pod |
| Pod (fake) | `C2:4F:23:0B:B5:43` | CircuitPython fake pod |

## Conventions

- All JS/TS packages use `"type": "module"` (ESM only)
- Use `npm run cli -- <args>` from workspace root to invoke the CLI
- `--json` flag on CLI commands for machine-readable output
- Protocol docs in `documents/` are the source of truth; `decompilation/` is raw reference
