# Web App Pod Connection — Implementation Plan

**Goal:** Add pod connection management (init hub, add/remove pod, write button map) to the web app's device list page.

**Architecture:** Wire existing `ProtocolCommands` methods (`setBikeNet`, `addDevice`, `removeDevice`, `writeButtonMap`) through `store.ts` actions into `page-device-list.ts` UI. The captured button map entries move to `open-elin-lib` so both CLI and web can share them.

**Tech Stack:** Lit, Shoelace (dialogs, inputs, buttons), open-elin-lib

**Testing:** Red/green TDD via Playwright e2e in demo mode. Demo transport (`transport-demo.ts`) needs handlers for `addDevice`, `removeDevice`, `setBikeNet`, `writeButtonMap`. Tests use `DeviceListPageModel` and demo state fixtures.

**Run tests:** `npm run test:e2e --workspace=web` (or `--headed` variant)

---

### Task 1: Extract default button map builder to open-elin-lib

The hardcoded `CAPTURED_ENTRIES` array in `cli/src/commands/hub/write-button-map.ts` has pod/hub MACs baked in. Extract to a shared function `buildDefaultButtonMap(podMac, hubMac): ButtonMapEntry[]` that generates the 7 standard entries for any pod+hub pair.

**Files:**
- Create: `lib/src/default-button-map.ts`
- Create: `cli/src/commands/hub/write-default-button-map.ts`
- Modify: `cli/src/cli.ts` (add `write-default-button-map` command)
- Modify: `cli/src/commands/hub/write-button-map.ts` (import from lib instead)
- Modify: `.github/skills/connect-pod/SKILL.md` (update step 3 to use new command)

- [ ] **Step 1:** Create `lib/src/default-button-map.ts` exporting `buildDefaultButtonMap(podMac: string, hubMac: string): ButtonMapEntry[]` — takes colon-separated MACs, converts to LE hex, returns the 7 entries with the correct button→function mappings
- [ ] **Step 2:** Update `lib/package.json` exports to add `"./default-button-map"` entry
- [ ] **Step 3:** Add `writeDefaultButtonMap(podMac: string)` method to `ProtocolCommands` in `lib/src/commands.ts` — calls `buildDefaultButtonMap(podMac, this.device.address)` then `this.writeButtonMap(entries)`
- [ ] **Step 4:** Update CLI `write-button-map.ts` to import `buildDefaultButtonMap` from lib instead of inlining the array
- [ ] **Step 5:** Add new CLI command `write-default-button-map` — takes `--pod-mac <MAC>` (required), connects to hub, calls `commands.writeDefaultButtonMap(podMac)`. Register in `cli.ts`.
- [ ] **Step 6:** Update `.github/skills/connect-pod/SKILL.md` step 3 to use `hub write-default-button-map --address <hub-mac> --pod-mac <pod-mac>` instead of `write-button-map --use-captured`
- [ ] **Step 7:** Verify CLI still works: `npm run cli -- --help`
- [ ] **Step 8:** Commit

---

### Task 2: Add hub mock GUI panel and pairing flow

In demo mode the sidebar shows a pod mock GUI for simulating button presses. Add an analogous `hub-mock-gui` component showing the hub image with a reset button overlay. Clicking reset simulates a real hub factory reset: all hub state returns to defaults (12-speed setup, default name, empty device list, empty button map). After reset, the hub enters a 60-second **pairing window**. During that window, a 6-second long-press on the pod mock GUI's pair button bonds the pod to the hub — just like the real hardware setup flow.

**Files:**
- Create: `web/src/web/demo/hub-mock-gui.ts`
- Modify: `web/src/web/demo/hub-mock.ts` (add `reset()` method, pairing window state)
- Modify: `web/src/web/demo/pod-mock.ts` (add button D)
- Modify: `web/src/web/demo/pod-mock-gui.ts` (add D button overlay with 6s long-press pairing behaviour)
- Modify: `web/src/web/demo/demo-state.ts` (clear device list on hub reset)
- Modify: `web/src/web/components/shell-device.ts` (render `hub-mock-gui` in demo sidebar)

- [ ] **Step 1:** Add `reset()` to `HubMock` — restores all state to defaults from `hub-mock-data.json`, sets `pairingWindow = true`, starts 60s timer that sets `pairingWindow = false`. Clears `demoState.list.entries`. Sets current position to gear 1 / smallest cog offset (cable maximally extended, lowest tension). This models the physical factory reset button behavior, not `setBikeNet`.
- [ ] **Step 2:** Add `pair(podMac: string)` to `HubMock` — only succeeds if `pairingWindow` is true. Adds pod entry to `demoState.list.entries`, writes default button map via `buildDefaultButtonMap`, sets `pairingWindow = false`.
- [ ] **Step 3:** Add button D to `pod-mock.ts` — button ID `0x12` (matches label "D" in button map). Add `PodButton` type entry, `BUTTON_IDS` entry, and `pressButtonDDown()` / `pressButtonDUp()` methods matching the A/B pattern.
- [ ] **Step 4:** Create `hub-mock-gui.ts` following `pod-mock-gui.ts` pattern — Lit component with hub image (`../images/hub.png`), overlay button on the physical reset button, pairing status indicator (countdown or LED-style glow while pairing window is open)
- [ ] **Step 5:** Add D button overlay to `pod-mock-gui.ts` at the physical pairing button position. Requires 6-second long-press (hold pointer/key). Show progress indicator during hold. On complete, calls `hubMock.pair(podMac)`. Only active when hub pairing window is open; fires normal `pressButtonDDown/Up` events otherwise (so it can also be used for shift-down via button map).
- [ ] **Step 6:** Register `<hub-mock-gui>` and add to `shell-device.ts` sidebar next to `<pod-mock-gui>` in demo mode
- [ ] **Step 7:** Commit

---

### Task 3: Fix demo mock — button presses require button map

The demo transport currently shifts gears from pod button presses using a hardcoded `BUTTON_SHIFT_MAP` lookup, completely ignoring the button map. Real hardware only responds to presses that match a stored button map entry. Fix this so the mock only shifts when a matching entry exists in `hub.state.buttonTable`.

**Files:**
- Modify: `web/src/web/demo/transport-demo.ts`
- Modify: `web/src/web/demo/demo-state.ts` (if state shape needs changes)

- [ ] **Step 1:** Add `setBikeNet` handler (opcode `0x0005`) — return success response (exact side-effects on real hardware unverified; demo handler is a stub)
- [ ] **Step 2:** Add `addDevice` handler (opcode `0x0001`) — parse pod MAC from payload, add entry to `demoState.list.entries`, return success. If already present, return `INVALID_STATE` (`0x8003`)
- [ ] **Step 3:** Add `removeDevice` handler (opcode `0x0002`) — parse pod MAC from payload, remove entry from `demoState.list.entries`, return success
- [ ] **Step 4:** Add `writeButtonMap` handler (opcode `0x0014`) — parse entries from payload (size header sub-opcode `00`, then entry sub-opcode `01` per entry). Update `hub.state` `buttonTable` entries AND `buttonMap.mapBytes` so a subsequent `readButtonMap` (opcode `0x0015`) returns what was written. Return success for each sub-command.
- [ ] **Step 5:** Replace hardcoded `BUTTON_SHIFT_MAP` in `handlePodButtonAction` — look up the button ID against `hub.state.buttonTable` entries for the connected pod. Only fire a shift/tune action if a matching entry exists with the correct function code. No map entry = no action (mirrors real HW).
- [ ] **Step 6:** Commit

---

### Task 4: RED — Write failing e2e test for full pod setup flow

**Files:**
- Create: `web/e2e/fixtures/pod-connection.demo.spec.ts`
- Modify: `web/e2e/pages/DeviceListPageModel.ts` (add new locators)

- [ ] **Step 1:** Add locators to `DeviceListPageModel`: `createBikeNetButton()`, `addPodButton()`
- [ ] **Step 2:** Write test: "Full setup: add pod, write button map, pod buttons shift gears"
  - Start demo with hub reset (empty device list) → navigate to device list
  - Click Add Pod → enter MAC `D5:89:B2:13:FA:04` → submit → assert pod appears in list
  - Navigate to buttons page → click Write Default Button Map → assert success
  - Press shift-up pod button → assert gear position increases
  - Press shift-down pod button → assert gear position decreases
- [ ] **Step 3:** Run test — verify it fails
- [ ] **Step 4:** Commit failing test

---

### Task 5: GREEN — Implement Create BikeNet, Add Pod, and Write Default Button Map

**Files:**
- Modify: `web/src/web/store.ts` — add `setBikenet()`, `addDevice()`, `writeDefaultButtonMap()` actions
- Modify: `web/src/web/components/page-device-list.ts` — add buttons + dialogs
- Modify: `web/src/web/components/page-device-buttons.ts` — add Write Default Button Map button

- [ ] **Step 1:** Add `setBikenet()` to store — calls `deviceCommands.setBikeNet()`, logs result. Register in `appActions`.
- [ ] **Step 2:** Add "Create BikeNet" button to device list card header (warning style, destructive); on click show Shoelace confirm dialog "This configures BikeNet on the hub. Continue?"; on confirm call `appActions.setBikenet()`
- [ ] **Step 3:** Add `addDevice(podMac: string)` to store — calls `deviceCommands.addDevice(podMac)`, logs result, auto-refreshes list. Register in `appActions`.
- [ ] **Step 4:** Add "Add Pod" button to card header; on click show Shoelace dialog with MAC text input (placeholder: `D5:89:B2:13:FA:04`); on submit call `appActions.addDevice(mac)`
- [ ] **Step 5:** Add `writeDefaultButtonMap()` to store — gets pod MAC from first device list entry, calls `deviceCommands.writeDefaultButtonMap(podMac)`, logs result. Register in `appActions`.
- [ ] **Step 6:** Add "Write Default Button Map" button to the buttons page card header
- [ ] **Step 7:** Run full-flow test — verify it passes
- [ ] **Step 8:** Commit

---