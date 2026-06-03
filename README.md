# OpenElin

Open-source tools and DIY pod firmware for the [NXS Wireless](https://shop.ogbikeworks.com/products/1x-mtb-wireless-kit) electronic shifting system.

## What's in here

| Folder          | What it is                                              |
| --------------- | ------------------------------------------------------- |
| `web/`          | Browser app for configuring NXS hubs via Web Bluetooth  |
| `cli/`          | Node.js CLI for controlling hubs over BLE               |
| `lib/`          | Shared protocol library (Node.js + browser)             |
| `firmware-pod/` | Zephyr C pod firmware for DIY SuperMini nRF52840 pod    |
| `documents/`    | Protocol specs, hardware maps, observed behavior notes  |
| `prints/`       | 3D-printable parts (battery holders, mounts, pod cases) |

## Prerequisites

| Tool                             | Version | Used for                                     |
| -------------------------------- | ------- | -------------------------------------------- |
| [Node.js](https://nodejs.org)    | ≥ 22    | Web app, CLI, shared lib                     |
| [Docker](https://www.docker.com) | any     | Building pod firmware (Zephyr SDK toolchain) |
| PowerShell                       | ≥ 5.1   | Build/flash/test scripts in `firmware-pod/`  |

Optional:

- **OpenOCD** — flashing bootloader to SuperMini nRF52840 via SWD
- **FreeCAD** — editing 3D print files in `prints/`

## Web app

The web app connects to an NXS hub directly from your browser using Web Bluetooth. It supports:

- Scanning and connecting to hubs
- Pairing/unpairing pods
- Shifting gears and fine-tuning cog positions
- Reading and writing button maps
- Cog profile management

A built-in demo mode lets you explore the UI without hardware.

## Pod firmware

Custom pod firmware for the SuperMini nRF52840 board. Lets a DIY pod connect to the stock NXS hub, pair, and shift gears. See [`firmware-pod/README.md`](firmware-pod/README.md) for build and flash instructions.

## CLI

Command-line tool for hub interaction over BLE (Linux/macOS). Uses `@abandonware/noble`.

```bash
npm run cli -- scan              # Find nearby hubs
npm run cli -- get-position      # Read current gear position
npm run cli -- shift-up          # Shift to harder gear
npm run cli -- shift-down        # Shift to easier gear
npm run cli -- read-button-map   # Read pod button mapping
```

Use `--json` for machine-readable output.

## Disclaimer

This is a personal work-in-progress dump. Polishing was not a goal.

Use at your own risk. Bad firmware can brick a SuperMini (recoverable via SWD — see `firmware-pod/unbrick.ps1`). Motor commands can overdrive a derailleur. Shifting commands will shift your actual gears.

If you want to do real development with this, expect to find hardcoded MACs, paths, and other local assumptions that will need adapting to your setup.

## License

MIT
