# Plan: Hub card in device list with hub actions (sleep, blink, rename, calibrate, home)

## Context

The hub sidebar (`shell-device.ts`) has two icon buttons: **Rename** and **Disconnect**. Neither `blinkLed()` nor `powerDown()` are exposed in the web UI. The device list (`page-device-list.ts`) only shows pods from the `getList()` protocol command — the hub never appears.

This plan adds a **synthetic hub card** at the top of the device list, consolidating all hub-specific actions there. The rename button moves from the sidebar to the hub card. Calibrate moves from the device-list header to the hub card. Motor Home and Blink LED are new buttons. Sleep (power down) navigates to landing page.

### Hub card in device list

- Rendered **first** in the device list, before any pod entries, always visible when connected
- Uses existing `device-card` styling (draft, will polish later)
- Info: hub name, MAC, "Hub" pill (blue-tinted), battery voltage, type "eLink Hub"
- Populated from `appState.connectedDevice` (name), `appState.mac`, `appState.hubBatteryVoltage`
- Action buttons row at bottom of card:

| Button | Label | Behavior |
|--------|-------|----------|
| Blink LED | "Blink" | Calls `blinkLed()`, logs result |
| Calibrate | "Calibrate" | Calls `calibrate()` (moved from device-list header) |
| Home | "Home" | Calls `motorHome()`, logs result |
| Rename | "Rename" | Opens rename dialog (moved from sidebar) |
| Sleep | "Sleep" | Calls `powerDown()`, navigates to landing page |

### Sidebar changes

- **Remove** rename icon button from sidebar (moved to hub card)
- Keep disconnect button in sidebar (it's a connection action, not a hub device action)

## Files touched

| File | Change |
|------|--------|
| `open-elin-web/src/commands.ts` | Add `PowerDown: "0x0027"`, add `powerDown()` and `motorHome()` methods |
| `open-elin-web/src/web/store.ts` | Add `blinkLed()`, `powerDown()`, `motorHome()` actions, export in `appActions` |
| `open-elin-web/src/web/components/page-device-list.ts` | Add hub card with actions; move rename dialog here; remove calibrate from header |
| `open-elin-web/src/web/components/shell-device.ts` | Remove rename button + dialog + handlers from sidebar |
| `open-elin-web/src/web/components/app.ts` | Listen for `sleep-requested` from device list, navigate to `/` |
| `open-elin-web/e2e/pages/DevicePageModel.ts` | Remove `renameButton()` locator (moved) |
| `open-elin-web/e2e/pages/DeviceListPageModel.ts` | Add hub card locators + rename locators + sleep locator |
| `open-elin-web/e2e/fixtures/sleep.demo.spec.ts` | E2E: click sleep on hub card → returns to landing page |
| `open-elin-web/e2e/fixtures/device-list.demo.spec.ts` | Assert hub card appears first with correct info |
| `open-elin-web/e2e/fixtures/rename.demo.spec.ts` | Update to use hub card rename button instead of sidebar |

## Tasks

### 1. Red: hub card visibility e2e test

- [✅] In `DeviceListPageModel.ts`, add `hubCard()` → `getByTestId("device-list-hub-card")`
- [ ] Add `hubCardName()` → `hubCard().getByTestId("device-list-name")`
- [ ] Add `hubCardMac()` → `hubCard().getByTestId("device-list-mac")`
- [ ] Add `hubCardBattery()` → `hubCard().getByTestId("device-list-battery")`
- [ ] Add `hubCardPill()` → `hubCard().getByTestId("device-list-status")`
- [ ] In `device-list.demo.spec.ts`, add test "shows hub card at top with name, MAC, battery, and Hub pill":
  - Open app, start demo, go to device list
  - Assert `hubCard()` is visible
  - Assert `hubCardName()` has text "XSHIFTER ELIN"
  - Assert `hubCardMac()` has text "02:11:22:33:44:55"
  - Assert `hubCardPill()` has text "Hub"
  - Assert `hubCardBattery()` contains "V"
- [ ] **Run test → expect RED** (hub card doesn't exist yet)

### 2. Green: implement hub card rendering

- [✅] Add `PowerDown: "0x0027"` to `AppCommand` in `open-elin-web/src/commands.ts`
- [ ] Add `async powerDown(): Promise<BasicResponse>` method to `ProtocolCommands`
- [ ] Add `async calibrate(): Promise<BasicResponse>` method if missing
- [ ] Add `async motorHome(): Promise<BasicResponse>` method
- [ ] In `page-device-list.ts`, add `renderHubCard()` reading `appState.connectedDevice`, `appState.mac`, `appState.hubBatteryVoltage`:
  - `data-test-id="device-list-hub-card"` using `.device-card`
  - Hub name, MAC, "Hub" pill (blue-tinted draft), battery, "Type" = "eLink Hub"
- [ ] Render hub card **before** pod entries, always visible when connected (even when pod list empty)
- [ ] **Run test → expect GREEN**

### 3. Red: hub card action buttons e2e test

- [✅] In `DeviceListPageModel.ts`, add locators:
  - `hubBlinkButton()` → `getByTestId("hub-blink-button")`
  - `hubCalibrateButton()` → `getByTestId("hub-calibrate-button")`
  - `hubHomeButton()` → `getByTestId("hub-home-button")`
  - `hubRenameButton()` → `getByTestId("hub-rename-button")`
  - `hubSleepButton()` → `getByTestId("hub-sleep-button")`
- [ ] In `device-list.demo.spec.ts`, add test "hub card shows action buttons":
  - Open app, start demo, go to device list
  - Assert all five action buttons are visible on the hub card
- [ ] **Run test → expect RED**

### 4. Green: implement hub card action buttons

- [✅] In `store.ts`, add `blinkLed()` action (get commands, call `blinkLed()`, log result/error)
- [ ] Add `powerDown()` action (catch timeout as success — hub dies before ACK)
- [ ] Add `motorHome()` action (get commands, call `motorHome()`, log result/error)
- [ ] Add all three to `appActions` export
- [ ] In `page-device-list.ts`, add actions row to hub card with `sl-button size="small"` buttons:
  - Blink: `data-test-id="hub-blink-button"`, calls `appActions.blinkLed()`
  - Calibrate: `data-test-id="hub-calibrate-button"`, calls `appActions.calibrate()`
  - Home: `data-test-id="hub-home-button"`, calls `appActions.motorHome()`
  - Rename: `data-test-id="hub-rename-button"`, opens rename dialog
  - Sleep: `data-test-id="hub-sleep-button"`, dispatches `sleep-requested` event
- [ ] Remove Calibrate button from device-list header
- [ ] **Run test → expect GREEN**

### 5. Red: sleep flow e2e test

- [✅] Create `open-elin-web/e2e/fixtures/sleep.demo.spec.ts`
- [ ] Test: "returns to landing page after sleep" — open app, start demo, go to device list, click hub sleep button, assert landing page visible
- [ ] **Run test → expect RED** (sleep event not handled yet)

### 6. Green: implement sleep flow

- [✅] In `app.ts`, add `@sleep-requested=${this.handleSleep}` on `<shell-device>` (event bubbles from device list)
- [ ] Add `private async handleSleep()` — calls `await appActions.powerDown()`, `appActions.clearStoredMac()`, navigates to `/`
- [ ] **Run test → expect GREEN**

### 7. Red: rename via hub card e2e test

- [✅] In `DeviceListPageModel.ts`, add rename dialog locators: `renameDialog()`, `renameInput()`, `renameInputControl()`, `renameConfirmButton()`
- [ ] Add `async openRenameDialog()` → clicks hub rename button
- [ ] In `rename.demo.spec.ts`, update all tests to navigate to device list tab and use `DeviceListPageModel` locators instead of `DevicePageModel` sidebar locators
- [ ] **Run test → expect RED** (rename dialog not yet in device list)

### 8. Green: move rename dialog to device list

- [✅] Move rename `<sl-dialog>` markup from `shell-device.ts` to `page-device-list.ts`
- [ ] Move rename state (`renameOpen`, `renameValue`, `renameError`, `renameBusy`) and methods (`openRename`, `closeRename`, `onRenameInput`, `confirmRename`, `onRenameRequestClose`) to `page-device-list.ts`
- [ ] **Run test → expect GREEN**

### 9. Clean up: remove rename from sidebar

- [✅] In `shell-device.ts`, remove rename icon `<button>` from `.sidebar-actions`
- [ ] Remove rename `<sl-dialog>` (already moved)
- [ ] Remove rename properties and methods
- [ ] In `DevicePageModel.ts`, remove `renameButton()`, `renameDialog()`, `renameInput()`, `renameInputControl()`, `renameConfirmButton()`, `openRenameDialog()`
- [ ] **Run full e2e suite → all GREEN**

### 10. Visual check: demo mode in browser

- [✅] Start dev server, open in VS Code browser, connect in demo mode
- [ ] Navigate to device list, visually verify hub card renders with correct info and action buttons
- [ ] Click Blink, Calibrate, Home — verify log entries appear
- [ ] Click Rename — verify dialog opens and rename works
- [ ] Click Sleep — verify navigation to landing page
