# Retroactive make-feature Plan — Demo Flows + MAC Acquisition + E2E Expansion

This document backfills make-feature planning for work implemented before plan gating.
Reconstruction is based on git history and current code state.

---

## Scope (Executed)

- Expanded deterministic demo-mode E2E coverage across key tabs and sidebar behavior.
- Implemented and tested MAC acquisition flow variants:
  - manual MAC entry,
  - shift-complete MAC capture,
  - WebBluetooth advertisement discovery via browser API monkey patch.
- Added Alt-modified Demo entry behavior for full MAC flow while preserving default Demo convenience.
- Added disconnect flow coverage with stable selectors.
- Refactored shared connection/reconnect empty-state UI and tightened visual spacing.
- Performed shell/page naming and E2E layout cleanup without changing user-facing behavior.

---

## Reconstructed Timeline (from git)

### 1) Foundation: Playwright + deterministic fixture model

- Initial Playwright setup and first demo-mode cogs coverage.
- Added fixture-based state mutators for demo hub/pod/data to make assertions deterministic.
- Added demo transport timing controls for predictable async behavior in tests.

### 2) Coverage expansion: core device flows

- Added/expanded tests for cogs, list, motor params, rename, log, and sidebar.
- Hardened selectors via `data-test-id` and moved assertions to concrete seeded outcomes.

### 3) MAC acquisition behavior and routing

- Added `/mac` acquisition behavior with manual and shift paths.
- Added Alt-modified full-demo path so default Demo remains fast while full flow remains testable.
- Added route progression from acquisition completion to device route.

### 4) BLE advertisement contract test in CI

- Added browser-level monkey patch for WebBluetooth ad path.
- Simulated `watchAdvertisements` + manufacturer payload to validate app-side MAC extraction path without hardware.

### 5) Disconnect coverage and selector policy

- Added demo disconnect flow spec.
- Added explicit disconnect `data-test-id` and updated model selectors accordingly.
- Documented selector policy: add missing test IDs instead of relying on brittle fallbacks.

### 6) Shared empty-state extraction and cleanup

- Unified landing/reconnect empty-state UI into shared component.
- Removed excess visual gap from base empty-state stack layout.

---

## Files of Interest

### Runtime and UI

- `src/web/components/app.ts` (or renamed shell entry): route orchestration for `/`, `/mac`, `/device/:mac/:page`.
- `src/web/store.ts`: demo/full mode behavior, MAC source handling, and route-impacting state transitions.
- `src/web/components/landing-page.ts`: connect/demo entry wiring.
- `src/web/components/page-mac.ts` (or equivalent): MAC acquisition interactions.
- `src/web/components/page-device.ts` / `shell-device.ts`: disconnected-state handling + sidebar/disconnect.
- `src/web/components/connection-empty-state.ts`: shared connection empty state.
- `src/web/components/empty-state.ts`: visual primitive (layout gap adjusted).
- `src/web/demo/transport-demo.ts` (or equivalent): deterministic demo protocol simulation.

### E2E

- `e2e/fixture.ts` (or historical `e2e/fixtures.ts`): shared demo mutator fixture.
- `e2e/pages/*.ts`: page-model interaction/read API.
- `e2e/**/*.spec.ts`: demo flow acceptance coverage.

---

## Final Behavior Delivered

- Default Demo remains the quick path.
- Alt-modified Demo enters full MAC acquisition path when needed.
- MAC can be acquired from manual input, shift-complete, or advertisement discovery.
- Disconnect returns to landing connection state and clears active session.
- Shared connection empty-state markup reused consistently.

---

## Test Coverage Matrix

- `cogs.demo.spec.ts`
- `device-list.demo.spec.ts`
- `motor-params.demo.spec.ts`
- `rename.demo.spec.ts`
- `log.demo.spec.ts`
- `sidebar.demo.spec.ts`
- `mac-acquisition.demo.spec.ts`
- `mac-advertisement.webbluetooth.spec.ts`
- `disconnect.demo.spec.ts`

Validation command:

- `npm run test:e2e`

Observed end-state:

- Full suite passing (13 tests).

---

## Key Decisions and Tradeoffs

- Hardware-dependent paths are out-of-scope for CI; browser API monkey patches provide contract-level confidence.
- Demo UX stays fast by default; full path is explicit and opt-in.
- Deterministic fixture seeding is preferred over opportunistic runtime checks.
- Missing test selectors are added in UI code first, then used in models/specs.

---

## Process Corrections for Next Feature

- Always start with a plan doc before first implementation edit.
- Before file moves/renames, write expected import path updates.
- Validate in two tiers: focused specs first, then full suite gate.
