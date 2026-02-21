# demo-node

TypeScript prototype to scan and list BLE devices (uses `noble`). Highlights the NXS service UUID if advertised.

Quick start:

1. Install dependencies:

```bash
cd demo-node
npm install
```

CLI app (BLE scanner):

1. Run the scanner:

```bash
npm start
```

Web app (browser UI):

1. Start the Vite dev server:

```bash
npm run dev
```

2. Open it in your browser:

- https://localhost:5173
- https://<your-lan-ip>:5173 (for other devices on your network)

Notes:

- `noble` requires appropriate system permissions and may need native Bluetooth support/drivers. On Linux you may need to run with sudo or enable capabilities.
- The scanner lists discovered peripherals with id, address, name, RSSI, service UUIDs and manufacturer data hex.

## E2E tests (Playwright)

The repo includes basic Playwright coverage for the demo-mode cogs flow.

1. Install dependencies:

```bash
npm install
```

2. Install Chrome for Playwright:

```bash
npx playwright install chrome
```

3. Run E2E tests:

```bash
npm run test:e2e
```

4. Run headed mode locally:

```bash
npm run test:e2e:headed
```

Notes:

- Tests live under `e2e/`.
- Selectors use `data-test-id`.
- Coverage is demo-mode only and exercises the cogs screen interactions.
