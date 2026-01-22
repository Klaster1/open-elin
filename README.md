# demo-node

TypeScript prototype to scan and list BLE devices (uses `noble`). Highlights BikeNet service UUID if advertised.

Quick start:

1. Install dependencies:

```bash
cd demo-node
npm install
```

2. Run scanner:

```bash
npm start
```

Notes:

- `noble` requires appropriate system permissions and may need native Bluetooth support/drivers. On Linux you may need to run with sudo or enable capabilities.
- The scanner lists discovered peripherals with id, address, name, RSSI, service UUIDs and manufacturer data hex.
