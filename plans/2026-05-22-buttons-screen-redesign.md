# Buttons Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Buttons page from a flat list of raw map entries into a "keybind config" screen — grouped by pod, with a pod indicator showing wired-button bindings and an orphan list below for non-wired bindings. Each physical button is a group showing its trigger→function pairs (Press/Release/Double press), with support for adding multiple triggers per button. Chords (button2) are ignored. Both wired and orphan bindings are editable and removable. Live write-to-hub on change.

**Architecture:** The current `page-device-buttons.ts` renders 7 flat cards (one per button-map row). The new design groups by pod MAC and splits entries into two sections: (1) a **pod indicator** — the pod diagram with wired-button bindings shown directly on it, editable and removable; (2) an **orphan bindings list** below — entries whose button codes aren't physically wired to the pod, also editable and removable. A pod model profile (`POD_MODELS`) maps device names (e.g. `"NXS MTB Pod"`) to their wired button codes and button positions.

Each binding is a **3-tuple**: button + trigger type + function. The protocol supports 3 trigger types: Press (`0x00`), Release (`0x01`), Double press (`0x02`). The same physical button can have multiple entries with different triggers (e.g. A-Press→Shift Up, A-Double→Toggle). Chords (button2) are not surfaced — always `0x00`. Bindings are grouped by physical button code: each button is a group showing its trigger→function pairs, with an "Add trigger" control to create new triggers. Available triggers in the "Add" control exclude triggers already assigned for that button.

A new `<pod-diagram>` component is extracted from the existing `PodMockGui` — it renders the pod image with positioned transclusion slots and SVG leader lines. Each button position is a named `<slot>` element; if a slot isn't filled, nothing renders for that position. This lets the mock GUI fill slots with pressable buttons while the buttons config screen fills them with action labels/dropdowns. The component is parameterized by `PodModel` so different pods can have different button counts and positions.

Editing a slot triggers an immediate `writeButtonMap` to the hub. Button labels are fixed: `0x00` → `A` (base), consistent with B/C/D base naming.

**Tech Stack:** Lit + @lit-labs/signals, Shoelace (sl-select, sl-button, sl-icon-button), existing `open-elin-lib` commands, Playwright E2E.

**TDD Approach:** Every task follows red/green TDD. Write the failing test first, run it to confirm it fails, then write the minimal implementation to make it pass, then run the test to confirm it passes. All tests are Playwright E2E — this project has no unit test infrastructure.

**Test command:** `cd c:\dev\nxs\web ; npx playwright test --reporter=line`

**Single test file:** All new tests go in `web/e2e/fixtures/buttons.demo.spec.ts`. Tests are added incrementally — each task appends tests to this file, then implements to make them pass.

**Test skill:** All test code in this plan follows `.github/skills/write-test/SKILL.md` — comment-structured specs, `getByTestId()` selectors, `updateDemoHubState` fixture mutators for seeding, branch-free deterministic flows, assertions in specs not page models.

---

### Task 1: Rename button `0x00` from `"-"` to `"A"` + write first E2E test

**Files:**
- Create: `web/e2e/fixtures/buttons.demo.spec.ts`
- Modify: `web/e2e/pages/ButtonsPageModel.ts` (add new locators for later tasks)
- Modify: `lib/src/commands.ts` (BUTTON_LABELS)
- Modify: `lib/src/default-button-map.ts` (comment)
- Modify: `web/src/web/demo/pod-mock.ts` (local BUTTON_LABELS)

- [ ] **Add new locators to ButtonsPageModel**

Add to `web/e2e/pages/ButtonsPageModel.ts` — interaction/read helpers only, no assertions:

```typescript
podGroups(): Locator {
  return this.page.getByTestId("pod-group");
}

podIndicator(): Locator {
  return this.page.getByTestId("pod-indicator");
}

podIndicatorImage(): Locator {
  return this.page.getByTestId("pod-indicator").locator("img");
}

wiredButtonGroups(): Locator {
  return this.page.getByTestId("wired-button-group");
}

wiredBindings(): Locator {
  return this.page.getByTestId("wired-binding");
}

orphanButtonGroups(): Locator {
  return this.page.getByTestId("orphan-button-group");
}

orphanBindings(): Locator {
  return this.page.getByTestId("orphan-binding");
}

removeBindingButtons(): Locator {
  return this.page.getByTestId("remove-binding");
}

addTriggerButtons(): Locator {
  return this.page.getByTestId("add-trigger");
}
```

- [ ] **Write the failing test**

Create `web/e2e/fixtures/buttons.demo.spec.ts` — one comprehensive test covering the full redesigned buttons screen:

```typescript
import { expect, test } from "../fixture";
import { ButtonsPageModel } from "../pages/ButtonsPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test("buttons screen shows trigger types, supports add/remove triggers and orphan removal", async ({ page }) => {
  const landing = new LandingPageModel(page);
  const device = new DevicePageModel(page);
  const buttons = new ButtonsPageModel(page);

  // Go to app
  await landing.open();
  await expect(landing.root()).toBeVisible();

  // Start demo mode (default hub has 7 button entries for 1 pod)
  await landing.startDemo();
  await expect(page).toHaveURL(device.deviceRouteMatcher());

  // Go to buttons screen
  await device.goToButtonsTab();

  // Assert buttons list is visible
  await expect(buttons.list()).toBeVisible();

  // Assert 1 pod group visible (all entries share one pod MAC)
  await expect(buttons.podGroups()).toHaveCount(1);

  // Assert pod indicator image visible
  await expect(buttons.podIndicatorImage()).toBeVisible();

  // Assert 3 wired button groups (A, A-1, A-2)
  await expect(buttons.wiredButtonGroups()).toHaveCount(3);
  await expect(buttons.wiredButtonGroups().nth(0)).toContainText("A");
  await expect(buttons.wiredButtonGroups().nth(1)).toContainText("A-1");
  await expect(buttons.wiredButtonGroups().nth(2)).toContainText("A-2");

  // Assert 3 wired bindings — each button has 1 trigger (Press)
  await expect(buttons.wiredBindings()).toHaveCount(3);
  await expect(buttons.wiredBindings().nth(0)).toContainText("Press");
  await expect(buttons.wiredBindings().nth(0)).toContainText("Shift Up");
  await expect(buttons.wiredBindings().nth(1)).toContainText("Press");
  await expect(buttons.wiredBindings().nth(1)).toContainText("Shift Down");
  await expect(buttons.wiredBindings().nth(2)).toContainText("Press");
  await expect(buttons.wiredBindings().nth(2)).toContainText("Tune Mode");

  // Assert 4 orphan bindings — all show Press trigger
  await expect(buttons.orphanBindings()).toHaveCount(4);
  await expect(buttons.orphanBindings().first()).toContainText("Press");

  // Assert empty state is hidden when map has entries
  await expect(buttons.emptyState()).toBeHidden();

  // Assert refresh button is visible
  await expect(buttons.refreshButton()).toBeVisible();

  // Add a new trigger to button A (click add-trigger on first wired group)
  await buttons.wiredButtonGroups().first().getByTestId("add-trigger").click();
  await page.waitForTimeout(200);

  // Assert 4 wired bindings now (new Release→Shift Up added to button A)
  await expect(buttons.wiredBindings()).toHaveCount(4);

  // Change new binding's function to Toggle
  await buttons.wiredBindings().nth(1).getByTestId("function-select").selectOption("0C");
  await page.waitForTimeout(200);

  // Assert new binding shows Release trigger and Toggle function
  await expect(buttons.wiredBindings().nth(1)).toContainText("Release");
  await expect(buttons.wiredBindings().nth(1)).toContainText("Toggle");

  // Refresh to confirm trigger addition persisted
  await buttons.clickRefresh();
  await expect(buttons.wiredBindings()).toHaveCount(4);
  await expect(buttons.wiredBindings().nth(1)).toContainText("Release");
  await expect(buttons.wiredBindings().nth(1)).toContainText("Toggle");

  // Remove the Release trigger from button A
  await buttons.wiredBindings().nth(1).getByTestId("remove-binding").click();
  await page.waitForTimeout(200);

  // Assert back to 3 wired bindings
  await expect(buttons.wiredBindings()).toHaveCount(3);

  // Remove all 4 orphan bindings one at a time
  for (let i = 0; i < 4; i++) {
    await buttons.orphanBindings().first().getByTestId("remove-binding").click();
    await page.waitForTimeout(200);
  }

  // Assert 0 orphan bindings remain
  await expect(buttons.orphanBindings()).toHaveCount(0);

  // Assert 3 wired bindings unchanged
  await expect(buttons.wiredBindings()).toHaveCount(3);

  // Refresh to confirm persistence (round-trip through hub)
  await buttons.clickRefresh();
  await expect(buttons.wiredBindings()).toHaveCount(3);
  await expect(buttons.orphanBindings()).toHaveCount(0);
});
```

This is the primary test for the entire redesigned feature. It covers: layout structure (pod groups, wired button groups), trigger type display, adding a new trigger, changing a function, removing triggers, removing orphan bindings, and persistence. Layout assertions go green after Task 5; trigger editing sections go green after Task 6.

- [ ] **Run the test — expect FAIL**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: FAIL — redesigned layout doesn't exist yet.

- [ ] **Implement the label rename**

In `lib/src/commands.ts`, change `BUTTON_LABELS["00"]` from `"-"` to `"A"`.

In `lib/src/default-button-map.ts`, fix comment: `// button A   → Shift Up`.

In `web/src/web/demo/pod-mock.ts`, change local `BUTTON_LABELS["00"]` from `"-"` to `"A"`.

- [ ] **Run the test — still FAIL (expected)**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: still FAIL — label rename is done but the pod-group/action-row layout hasn't been built yet. The test turns green after Task 5.

- [ ] **Run full E2E suite for regressions on the label rename**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: existing tests pass. Fix any assertion that expects `"-"` for button 0x00.

- [ ] **Commit**

```bash
git add lib/src/commands.ts lib/src/default-button-map.ts web/src/web/demo/pod-mock.ts web/e2e/fixtures/buttons.demo.spec.ts web/e2e/pages/ButtonsPageModel.ts
git commit -m "Rename button 0x00 from '-' to 'A' for consistent port naming" -m "Port A base button was labeled '-' while B/C/D used their letter. Now consistent: A, A-1..A-5, B, B-1..B-5, etc."
```

---

### Task 2: Add pod model profiles

**Files:**
- Create: `lib/src/pod-models.ts`

No test for this task — it's a pure data module with no behavior worth testing in isolation. It gets exercised by the E2E tests in Task 5 (inert badges, unbound ports).

- [ ] **Create pod-models.ts**

Create `lib/src/pod-models.ts`:

```typescript
export interface ButtonPosition {
  name: string;           // slot name: "tune", "up", "down", "pair"
  anchorPct: { x: number; y: number };  // leader line target on pod image (%)
  cssClass: string;       // positioning class: "pod-button-tune", etc.
}

export interface PodModel {
  name: string;
  wiredButtons: readonly string[];
  displayName: string;
  imageUrl?: string;      // per-model pod image (undefined = default pod.png)
  buttonPositions: readonly ButtonPosition[];
}

export const POD_MODELS: Record<string, PodModel> = {
  "NXS MTB Pod": {
    name: "NXS MTB Pod",
    displayName: "MTB Pod",
    wiredButtons: ["00", "01", "02"],
    buttonPositions: [
      { name: "tune", anchorPct: { x: 52, y: 37 }, cssClass: "pod-button-tune" },
      { name: "up",   anchorPct: { x: 76, y: 37 }, cssClass: "pod-button-up" },
      { name: "down", anchorPct: { x: 81, y: 75 }, cssClass: "pod-button-down" },
      { name: "pair", anchorPct: { x: 55, y: 65 }, cssClass: "pod-button-pair" },
    ],
  },
};

export function getPodModel(deviceName: string): PodModel | undefined {
  return POD_MODELS[deviceName];
}

export function isButtonWired(
  model: PodModel | undefined,
  buttonCode: string,
): boolean {
  if (!model) return true;
  return model.wiredButtons.includes(buttonCode.toUpperCase());
}
```

- [ ] **Run full E2E suite to confirm no breakage**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: all pass (new module isn't imported yet, no effect).

- [ ] **Commit**

```bash
git add lib/src/pod-models.ts
git commit -m "Add pod model profiles for wired-button detection" -m "PodModel maps BLE device name to physically wired button codes. NXS MTB Pod: A (0x00), A-1 (0x01), A-2 (0x02)."
```

---

### Task 3: Extract `<pod-diagram>` from `PodMockGui`

**Files:**
- Create: `web/src/web/components/pod-diagram.ts`
- Modify: `web/src/web/demo/pod-mock-gui.ts` (use `<pod-diagram>` internally)
- Modify: `web/e2e/fixtures/buttons.demo.spec.ts` (add test)

Extract the pod image + leader lines + positioned button containers into a reusable `<pod-diagram>` component. It uses named transclusion `<slot>` elements for each button position. Unfilled slots render nothing — this way the mock fills 4 positions (tune/up/down/pair) while the buttons screen can fill only the 3 wired ones.

- [ ] **Write the failing E2E test**

Append to `web/e2e/fixtures/buttons.demo.spec.ts`:

```typescript
test("pod diagram renders image and leader lines in mock GUI", async ({
  page,
}) => {
  const landing = new LandingPageModel(page);

  // Go to app
  await landing.open();
  await expect(landing.root()).toBeVisible();

  // Start demo mode
  await landing.startDemo();

  // Assert pod diagram component is visible in mock GUI
  const diagram = page.locator('pod-diagram');
  await expect(diagram).toBeVisible();

  // Assert pod image rendered inside diagram
  await expect(diagram.locator('img')).toBeVisible();

  // Assert 4 slot containers rendered (tune, up, down, pair)
  await expect(diagram.locator('.pod-slot')).toHaveCount(4);
});
```

- [ ] **Run the test — expect FAIL**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: FAIL — `<pod-diagram>` element doesn't exist yet.

- [ ] **Implement pod-diagram component**

Create `web/src/web/components/pod-diagram.ts`:

```typescript
import { LitElement, css, html, svg } from "lit";
import { property } from "lit/decorators.js";
import type { ButtonPosition } from "lib/pod-models";

const defaultPodImageUrl = new URL("../images/pod.png", import.meta.url).href;

export class PodDiagram extends LitElement {
  @property({ type: Array })
  positions: ButtonPosition[] = [];

  @property({ type: String })
  imageUrl?: string;

  static styles = css`
    :host { display: block; }

    .pod-image-wrap {
      position: relative;
      width: 100%;
      max-width: 220px;
    }

    .pod-image-wrap img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 18px;
    }

    .pod-leader-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }

    .pod-leader-line {
      stroke: rgba(140, 255, 200, 0.75);
      stroke-width: 1.2;
      stroke-dasharray: 2 2;
      fill: none;
    }

    .pod-slot {
      position: absolute;
    }

    /* Empty slots collapse to nothing */
    .pod-slot:empty { display: none; }

    .pod-button-tune { top: 4%; left: 4%; }
    .pod-button-up   { top: 4%; right: 4%; }
    .pod-button-down  { bottom: -2%; right: 4%; }
    .pod-button-pair  { bottom: -2%; left: 4%; }
  `;

  render() {
    const imgSrc = this.imageUrl ?? defaultPodImageUrl;
    return html`
      <div class="pod-image-wrap">
        <img src=${imgSrc} alt="Pod" />
        <svg class="pod-leader-svg" viewBox="0 0 100 100"
             preserveAspectRatio="none" aria-hidden="true">
          ${this.positions.map((pos) => {
            // Leader lines draw from slot edge toward anchor;
            // exact slot-edge coords are approximated from CSS positions.
            const slotEdge = this.slotEdgeForPosition(pos);
            return svg`<line class="pod-leader-line"
              x1=${slotEdge.x} y1=${slotEdge.y}
              x2=${pos.anchorPct.x} y2=${pos.anchorPct.y} />`;
          })}
        </svg>
        ${this.positions.map((pos) => html`
          <div class="pod-slot ${pos.cssClass}">
            <slot name=${pos.name}></slot>
          </div>
        `)}
      </div>
    `;
  }

  private slotEdgeForPosition(pos: ButtonPosition) {
    // Approximate slot edge positions matching CSS placement
    const edges: Record<string, { x: number; y: number }> = {
      "pod-button-tune": { x: 20, y: 8 },
      "pod-button-up":   { x: 80, y: 8 },
      "pod-button-down":  { x: 85, y: 95 },
      "pod-button-pair":  { x: 20, y: 95 },
    };
    return edges[pos.cssClass] ?? pos.anchorPct;
  }
}

customElements.define("pod-diagram", PodDiagram);
```

Key design: each position renders a `<div class="pod-slot">` wrapping a `<slot name="...">`. When the slot has no assigned content, `:empty` hides the container — nothing renders for unfilled positions.

- [ ] **Refactor PodMockGui to use pod-diagram**

In `web/src/web/demo/pod-mock-gui.ts`:
- Import `./components/pod-diagram.ts`
- Import `POD_MODELS` to get button positions for "NXS MTB Pod"
- Replace the inline `<div class="pod-image-wrap">` + `<img>` + `<svg>` + positioned buttons with:

```html
<pod-diagram .positions=${positions} .imageUrl=${undefined}>
  <button slot="tune" class="pod-button" ...>Tune</button>
  <button slot="up" class="pod-button" ...>Up</button>
  <button slot="down" class="pod-button" ...>Down</button>
  <button slot="pair" class="pod-button" ...>Pair</button>
</pod-diagram>
```

Move the button-specific CSS (`.pod-button` appearance, hover, active) to remain in `PodMockGui` (the diagram only handles layout).

- [ ] **Run the test — expect PASS**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: PASS.

- [ ] **Run full E2E suite (mock GUI behavior must be unchanged)**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: all pass — the mock GUI looks and behaves identically, just using the extracted component internally.

- [ ] **Commit**

```bash
git add web/src/web/components/pod-diagram.ts web/src/web/demo/pod-mock-gui.ts web/e2e/fixtures/buttons.demo.spec.ts
git commit -m "Extract pod-diagram component from PodMockGui" -m "Reusable <pod-diagram> renders pod image, SVG leader lines, and named transclusion slots for each button position. Unfilled slots collapse to nothing. PodMockGui now uses pod-diagram internally with pressable buttons in slots."
```

---

### Task 4: Add `writeButtonMap` store action + demo transport support

**Files:**
- Modify: `web/e2e/fixtures/buttons.demo.spec.ts` (add test)
- Modify: `web/src/web/store.ts`
- Modify: `web/src/web/demo/hub-mock.ts`
- Modify: `web/src/web/demo/transport-demo.ts`

- [ ] **Write the failing E2E test**

Append to `web/e2e/fixtures/buttons.demo.spec.ts`:

```typescript
test("writeButtonMap round-trip reduces visible entries", async ({
  page,
  updateDemoHubState,
}) => {
  const landing = new LandingPageModel(page);
  const device = new DevicePageModel(page);
  const buttons = new ButtonsPageModel(page);

  // Go to app
  await landing.open();
  await expect(landing.root()).toBeVisible();

  // Start demo mode
  await landing.startDemo();
  await expect(page).toHaveURL(device.deviceRouteMatcher());

  // Go to buttons screen
  await device.goToButtonsTab();

  // Assert 7 mapping cards visible (default map)
  await expect(buttons.mappingCards()).toHaveCount(7);

  // Seed hub with only 3 button table entries via mutator
  await updateDemoHubState((draft) => {
    draft.buttonTable = draft.buttonTable.slice(0, 3);
  });

  // Refresh to pick up seeded state
  await buttons.clickRefresh();

  // Assert 3 mapping cards visible after seed + refresh
  await expect(buttons.mappingCards()).toHaveCount(3);
});
```

- [ ] **Run the test — expect FAIL**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: FAIL — `updateDemoHubState` may not propagate to the buttons screen correctly, or the refresh doesn't re-read. Diagnose and adjust.

- [ ] **Implement writeButtonMap**

Add `setButtonTable` to `web/src/web/demo/hub-mock.ts`:

```typescript
setButtonTable(entries: HubStateShape["buttonTable"]) {
  const current = this.state.get();
  this.state.set({ ...current, buttonTable: entries });
}
```

Handle `WriteButtonMap` (`0x0014`) in `web/src/web/demo/transport-demo.ts`. Check the existing handler for `writeDefaultButtonMap` and replicate for arbitrary entries:
1. Accept the size header (subcommand `0x00`)
2. Accept each entry (subcommand `0x01`) — accumulate entries
3. After all entries received, call `demoHub.setButtonTable(accumulated)`

Add `writeButtonMap` action to `web/src/web/store.ts`:

```typescript
export async function writeButtonMap(entries: ButtonMapEntry[]) {
  const deviceCommands = commands.get();
  if (!deviceCommands) {
    appendLog("Connect to a hub first.");
    return;
  }
  appendLog("Write button map...", { entryCount: entries.length });
  try {
    const response = await deviceCommands.writeButtonMap(entries);
    appendLog("Write button map result", response ?? {});
    if (response.status === "success") {
      await readButtonTable();
    }
  } catch (err) {
    appendLog("Write button map error", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Run the test — expect PASS**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: PASS.

- [ ] **Run full E2E suite**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: all tests pass.

- [ ] **Commit**

```bash
git add web/src/web/store.ts web/src/web/demo/hub-mock.ts web/src/web/demo/transport-demo.ts web/e2e/fixtures/buttons.demo.spec.ts
git commit -m "Add writeButtonMap store action for arbitrary map entries" -m "Supports editing individual button assignments. Demo transport handles the write and updates hub mock state. E2E test verifies round-trip."
```

---

### Task 5: Redesign Buttons page — action-centric layout with pod diagram

**Files:**
- Modify: `web/e2e/fixtures/buttons.demo.spec.ts` (add test)
- Modify: `web/src/web/components/page-device-buttons.ts`

Target layout — the pod indicator shows wired bindings directly on the diagram; orphan bindings list below:

```
┌──────────────────────────────────────────────────┐
│  Buttons                              [Refresh]  │
│  Configure button-to-action mapping per pod.     │
│                                                  │
│  ── Pod: D5:89:B2:13:FA:04 (MTB Pod) ────────── │
│                                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │  [A: Shift Up ×]            [A-1: Shift Down ×] │
│  │                                              │ │
│  │              <pod-diagram>                    │ │
│  │                 pod.png                       │ │
│  │                                              │ │
│  │  [—: Pair]              [A-2: Tune Mode ×]   │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  Orphan Bindings                                 │
│  B → Shift Up         [×]                        │
│  B-1 → Shift Down     [×]                        │
│  C → Tune Mode        [×]                        │
│  D → Shift Up         [×]                        │
└──────────────────────────────────────────────────┘
```

Wired bindings are shown as interactive elements in the `<pod-diagram>` slots — each slot shows the button label, function, and a remove button. Orphan bindings (button codes not wired to this pod) appear in a flat list below, also editable and removable.

- [ ] **Implement the Buttons page redesign (makes Task 1 test pass)**

No new test — the comprehensive test from Task 1 (`"buttons screen shows trigger types, supports add/remove triggers and orphan removal"`) covers this. The goal of this task is to make that test's layout assertions go green.

Rewrite `web/src/web/components/page-device-buttons.ts`:

**splitByWired helper** using `getPodModel` + `isButtonWired` from `lib/pod-models`. Splits a pod's button table entries into `wired` (codes physically on the pod) and `orphan` (codes not wired).

**render()** groups buttonTable entries by pod MAC, then renders `renderPodGroup` for each.

**renderPodGroup:** pod indicator on top, orphan list below.

**renderPodIndicator:** wrapped in `[data-test-id="pod-indicator"]`. Uses `<pod-diagram .positions=${model.buttonPositions}>` with wired button groups in named slots. Each filled slot is a `[data-test-id="wired-button-group"]` containing: the button label, a list of `[data-test-id="wired-binding"]` rows (each with `<select data-test-id="trigger-select">` for trigger type, `<select data-test-id="function-select">` for function, and `[data-test-id="remove-binding"]` button), and a `[data-test-id="add-trigger"]` button. Unfilled slots collapse.

**renderOrphanBindings:** button-grouped list of entries whose button codes aren't wired. Each button is a `[data-test-id="orphan-button-group"]` containing: the button label, `[data-test-id="orphan-binding"]` rows with trigger and function `<select>` dropdowns and `[data-test-id="remove-binding"]`, and `[data-test-id="add-trigger"]`.

All `data-test-id` values must match `ButtonsPageModel` locators.

- [ ] **Run the Task 1 test — expect PASS**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: `"buttons screen shows trigger types, supports add/remove triggers and orphan removal"` now PASSES (layout assertions only — trigger editing sections still fail until Task 6).

- [ ] **Fix hub-reset spec (regression)**

Update `hub-reset.demo.spec.ts`: replace `mappingCards()` count = 7 with pod-group/wired-button-group/wired-binding assertions:
- After pairing: 1 pod group, 3 wired button groups, 3 wired bindings
- After reset + refresh: 0 pod groups, empty state visible

Run: `cd c:\dev\nxs\web ; npx playwright test hub-reset --reporter=line`
Expected: PASS.

- [ ] **Run full E2E suite**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: all pass.

- [ ] **Commit**

```bash
git add web/src/web/components/page-device-buttons.ts web/e2e/fixtures/buttons.demo.spec.ts web/e2e/fixtures/hub-reset.demo.spec.ts
git commit -m "Redesign Buttons page: button-grouped layout with trigger types" -m "Wired bindings shown as button groups on pod diagram with trigger→function rows and add-trigger controls. Orphan bindings use same grouped layout below. Grouped by pod MAC."
```

---

### Task 6: Wire slot editing with live write-to-hub

**Files:**
- Modify: `web/e2e/fixtures/buttons.demo.spec.ts` (add test)
- Modify: `web/src/web/components/page-device-buttons.ts`

- [ ] **Implement binding change/remove/add-trigger handlers (makes Task 1 test's editing sections pass)**

No new test — the comprehensive test from Task 1 covers: adding a trigger to button A, changing function to Toggle, persistence of trigger addition, removing a trigger, removing all orphan bindings, and final persistence check. The goal is to make all those sections go green.

In `page-device-buttons.ts`:

```typescript
private async onFunctionChange(event: Event, entry: ButtonMapEntry, podMac: string) {
  const select = event.target as HTMLSelectElement;
  await this.rebuildAndWrite(podMac, (entries) =>
    entries.map((e) => e === entry
      ? { ...e, function: { code: select.value, label: FUNCTION_LABELS[select.value] ?? select.value } }
      : e),
  );
}

private async onTriggerChange(event: Event, entry: ButtonMapEntry, podMac: string) {
  const select = event.target as HTMLSelectElement;
  await this.rebuildAndWrite(podMac, (entries) =>
    entries.map((e) => e === entry
      ? { ...e, action: { code: select.value, label: ACTION_LABELS[select.value] ?? select.value } }
      : e),
  );
}

private async onAddTrigger(buttonCode: string, podMac: string) {
  await this.rebuildAndWrite(podMac, (entries) => {
    const usedTriggers = entries
      .filter((e) => e.button1.code === buttonCode)
      .map((e) => e.action.code);
    const nextTrigger = ["00", "01", "02"].find((t) => !usedTriggers.includes(t));
    if (!nextTrigger) return entries; // all 3 triggers used
    const newEntry: ButtonMapEntry = {
      button1: { code: buttonCode, label: BUTTON_LABELS[buttonCode] ?? buttonCode },
      button2: { code: "00", label: "-" },
      action: { code: nextTrigger, label: ACTION_LABELS[nextTrigger] ?? nextTrigger },
      function: { code: "0A", label: "Shift Up" },
      podMac, hubMac: entries[0]?.hubMac ?? "",
    };
    return [...entries, newEntry];
  });
}

private async onRemoveBinding(entry: ButtonMapEntry, podMac: string) {
  await this.rebuildAndWrite(podMac, (entries) => entries.filter((e) => e !== entry));
}

private async rebuildAndWrite(
  podMac: string,
  transform: (entries: ButtonMapEntry[]) => ButtonMapEntry[],
) {
  if (this.loading) return;
  this.loading = true;
  try {
    const currentTable = appState.buttonTable.get() ?? [];
    const podEntries = currentTable.filter((e) => this.entryMatchesPod(e, podMac));
    const otherEntries = currentTable.filter((e) => !this.entryMatchesPod(e, podMac));
    const updated = transform(podEntries);
    const merged = [...otherEntries, ...updated].map((e, i) => ({ ...e, index: i }));
    await writeButtonMap(merged);
  } finally {
    this.loading = false;
  }
}
```

Four handlers: `onFunctionChange` updates the function dropdown, `onTriggerChange` updates the trigger type, `onAddTrigger` creates a new entry with the next available trigger type and default function (Shift Up), `onRemoveBinding` removes a single trigger→function entry. All call `writeButtonMap` immediately (auto-send on change). Works for both wired and orphan bindings. The "Add trigger" button is hidden when all 3 trigger types are already used for a button.

- [ ] **Run the test — expect PASS**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: PASS.

- [ ] **Run full E2E suite**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: all pass.

- [ ] **Commit**

```bash
git add web/src/web/components/page-device-buttons.ts web/e2e/fixtures/buttons.demo.spec.ts
git commit -m "Wire live write-on-change for binding editing" -m "Function change, trigger change, add trigger, and remove binding all immediately write the full map to the hub and refresh. Loading guard prevents double-writes."
```

---

### Task 7: Mock pod trigger types + end-to-end verification

**Files:**
- Modify: `web/src/web/demo/pod-mock.ts` (add doubleClickButton, add ACTION_LABELS["02"])
- Modify: `web/src/web/demo/pod-mock-gui.ts` (dynamic trigger buttons with labels from button table)
- Modify: `web/src/web/demo/transport-demo.ts` (match action codes from button table)
- Modify: `web/e2e/pages/MacPageModel.ts` (update pod button locator for new structure)
- Modify: `web/e2e/fixtures/buttons.demo.spec.ts` (add e2e verification test)

**Goal:** Close the loop: configure a binding with a trigger type → fire it on the mock pod → verify the result on the cogs screen. The mock pod GUI shows per-trigger sub-buttons labeled with the actual mapped function from the button table. The transport matches action codes from button table entries instead of using hardcoded shift-on-release / tune-on-press logic.

- [ ] **Write the failing E2E test**

Append to `web/e2e/fixtures/buttons.demo.spec.ts`:

```typescript
import { CogsPageModel } from "../pages/CogsPageModel";

test("configured trigger type executes correct function via mock pod", async ({ page }) => {
  const landing = new LandingPageModel(page);
  const device = new DevicePageModel(page);
  const buttons = new ButtonsPageModel(page);
  const cogs = new CogsPageModel(page);

  // Go to app and start demo
  await landing.open();
  await expect(landing.root()).toBeVisible();
  await landing.startDemo();
  await expect(page).toHaveURL(device.deviceRouteMatcher());

  // Navigate to cogs tab and assert initial gear is 1
  await device.goToCogsTab();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "1");

  // Press button A on mock pod (default mapping: Press → Shift Up)
  await page.getByTestId("pod-button-group-A").getByTestId("pod-trigger-press").click();
  await page.waitForTimeout(300);

  // Assert gear shifted up to 2
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "2");

  // Go to buttons screen and add Double press → Shift Down on button A
  await device.goToButtonsTab();
  await buttons.wiredButtonGroups().first().getByTestId("add-trigger").click();
  await page.waitForTimeout(200);
  await buttons.wiredBindings().nth(1).getByTestId("trigger-select").selectOption("02");
  await buttons.wiredBindings().nth(1).getByTestId("function-select").selectOption("0B");
  await page.waitForTimeout(200);

  // Double-press button A on mock pod (Double press → Shift Down)
  await page.getByTestId("pod-button-group-A").getByTestId("pod-trigger-double").click();
  await page.waitForTimeout(300);

  // Navigate to cogs tab and verify gear shifted back down to 1
  await device.goToCogsTab();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "1");

  // Assert mock pod labels reflect configured mappings for button A
  const buttonAGroup = page.getByTestId("pod-button-group-A");
  await expect(buttonAGroup).toContainText("Shift Up");
  await expect(buttonAGroup).toContainText("Shift Down");
  await expect(buttonAGroup).toContainText("Double press");
});
```

This test proves:
1. Default mapping works (Press → Shift Up → gear goes from 1 to 2)
2. Newly configured trigger works (Double press → Shift Down → gear goes from 2 back to 1)
3. Mock pod labels reflect actual button table mappings

- [ ] **Run the test — expect FAIL**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: FAIL — mock pod doesn't have trigger sub-buttons or dynamic labels yet.

- [ ] **Update pod-mock.ts**

Add `ACTION_LABELS["02"] = "Double press"`.

Add `doubleClickButton(button: PodButton)`:

```typescript
doubleClickButton(button: PodButton) {
  if (!this.state.get().online) return;
  this.emitButtonAction(BUTTON_IDS[button], 2);
}
```

Unlike press (press→delay→release), double-click is a single event with `actionFlag=2`.

- [ ] **Update transport-demo.ts — match action codes**

Refactor `handlePodButtonAction`:

```typescript
private handlePodButtonAction(buttonId: number, actionFlag: number) {
  const podMac = this.getPodMac();
  if (!podMac) return;
  const buttonHex = buttonId.toString(16).padStart(2, "0").toUpperCase();
  const actionHex = actionFlag.toString(16).padStart(2, "0").toUpperCase();
  const buttonTable = this.hub.getButtonTable();
  const entry = buttonTable.find(
    (e) =>
      e.button1.code.toUpperCase() === buttonHex &&
      e.action.code.toUpperCase() === actionHex &&
      e.podAddressHex.toUpperCase() === podMac.split(":").reverse().join("").toUpperCase(),
  );
  if (!entry) return;
  const fnCode = entry.function.code.toUpperCase();
  if (fnCode === "0A" || fnCode === "0B") {
    const direction = fnCode === "0A" ? "up" : "down";
    this.handleShift(this.getHubMac(), direction);
  }
}
```

Key changes:
- Match `e.action.code` against the actual `actionHex` (was hardcoded to `"00"`)
- Removed mode-based triggering (shift-on-release / tune-on-press) — now executes immediately when action code matches

**Side effect:** With the default button table (all entries have action=Press), shifts now trigger on press event instead of release event. This is correct per the button table semantics.

- [ ] **Update pod-mock-gui.ts — dynamic trigger buttons**

Refactor the mock pod GUI to show per-trigger sub-buttons with labels from the button table:

1. Subscribe to `appState.buttonTable` (or receive it as a property) to get current mappings
2. For each physical button position (tune/up/down/pair), look up the position's button code in the button table
3. Group entries by action code (trigger type)
4. Render a **pod button group** per physical button containing:
   - `data-test-id="pod-button-group-{label}"` (e.g. `pod-button-group-A`, `pod-button-group-B`)
   - Button label header (from button table: "A", "B", "C", "D")
   - For each trigger type with a mapping: a clickable sub-button:
     - `data-test-id="pod-trigger-press"` / `pod-trigger-release` / `pod-trigger-double`
     - Label shows trigger type + mapped function (e.g. "Press: Shift Up")
   - Unmapped trigger types: not rendered
5. Clicking a sub-button calls `demoPod.pressButtonDown(button)` for press, `demoPod.pressButtonUp(button)` for release, or `demoPod.doubleClickButton(button)` for double press

The physical button position → button code mapping remains hardcoded (up=A/0x00, down=B/0x06, tune=C/0x0C, pair=D/0x12).

Labels update reactively when the button table changes (e.g. after adding a new trigger on the buttons screen).

- [ ] **Fix mac-acquisition test (regression)**

Update `MacPageModel.podShiftUpButton()` from `getByTestId("pod-button-up")` to target the new structure:

```typescript
podShiftUpButton(): Locator {
  return this.page.getByTestId("pod-button-group-A").getByTestId("pod-trigger-press");
}
```

Run: `cd c:\dev\nxs\web ; npx playwright test mac-acquisition --reporter=line`
Expected: PASS.

- [ ] **Run the test — expect PASS**

Run: `cd c:\dev\nxs\web ; npx playwright test buttons.demo --reporter=line`
Expected: PASS.

- [ ] **Run full E2E suite**

Run: `cd c:\dev\nxs\web ; npx playwright test --reporter=line`
Expected: all pass.

- [ ] **Commit**

```bash
git add web/src/web/demo/pod-mock.ts web/src/web/demo/pod-mock-gui.ts web/src/web/demo/transport-demo.ts web/e2e/pages/MacPageModel.ts web/e2e/fixtures/buttons.demo.spec.ts
git commit -m "Mock pod: trigger sub-buttons with dynamic labels from button table" -m "Each physical button shows per-trigger-type sub-buttons labeled with the mapped function. Transport matches action codes from button table instead of hardcoded shift-on-release logic. E2E test verifies: configure trigger → fire on mock pod → verify on cogs screen."
```

---

## Notes for the implementer

1. **The pod mock emits codes `0x00` (A), `0x06` (B), `0x0C` (C), `0x12` (D)** — these are the demo pod's button IDs. The real MTB pod only emits `0x00`, `0x01`, `0x02`. Don't change the mock's button IDs to match real hardware unless explicitly asked.

2. **`writeButtonMap` protocol is a 2-step process**: size header (`0x00` subcommand) then each entry (`0x01` subcommand) with ACK. The existing `commands.ts` handles this. The demo transport needs the same sequence.

3. **When removing slots, verify whether the hub accepts 0 entries** — if size header sends `totalBytes=0`, does the hub ACK? Unknown. The UI should allow removing all slots, but may need a guard.

4. **Button code `0x00` was renamed from `"-"` to `"A"`** — grep spec files for `"-"` assertions before running tests.

5. **All E2E tests live in a single file**: `web/e2e/fixtures/buttons.demo.spec.ts`. No separate spec files per task.

6. **Test seeding**: Use `updateDemoHubState` fixture mutator to seed deterministic state. Call after `landing.open()` but before `landing.startDemo()` for pre-boot seeding, or after demo start for mid-test mutations. Do not use `window.__appActions` or `window.__appState` hacks.

7. **Comment style in tests**: Use concise imperative comments (`// Go to app`, `// Assert 7 mapping cards visible`). No `Step N` prefixes. Comments must describe exact assertion contracts.

8. **Tests navigate from landing**: Each test opens the app, starts demo, navigates to buttons. No synthetic `pairedPage`/`connectedPage` fixtures — use the real navigation flow.

9. **Task 7 changes transport trigger semantics**: After Task 7, the demo transport matches `action.code` from button table entries against the actual `actionFlag` from the pod event. This replaces the hardcoded shift-on-release / tune-on-press logic. Shifts now fire on press (because default entries have `action=Press`). The `mac-acquisition.demo.spec.ts` test needs its `podShiftUpButton()` locator updated to use the new `pod-button-group-A` / `pod-trigger-press` structure.

10. **Mock pod double-click is a single event**: `doubleClickButton()` emits one event with `actionFlag=2`. It does NOT send press→release. The transport matches it against entries with `action.code="02"` (Double press).
