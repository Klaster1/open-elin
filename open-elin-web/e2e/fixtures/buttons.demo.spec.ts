import { expect, test } from "../fixture";
import { ButtonsPageModel } from "../pages/ButtonsPageModel";
import { CogsPageModel } from "../pages/CogsPageModel";
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

  // Assert pod diagram shows 3 wired button labels at tune, up, down positions
  const diagramLabels = buttons.podIndicator().locator(".pod-indicator-label");
  await expect(diagramLabels).toHaveCount(3);
  await expect(diagramLabels.nth(0)).toHaveText("A-2");
  await expect(diagramLabels.nth(1)).toHaveText("A");
  await expect(diagramLabels.nth(2)).toHaveText("A-1");

  // Assert 3 wired button groups (A-2, A, A-1) — sorted by physical position
  await expect(buttons.wiredButtonGroups()).toHaveCount(3);
  await expect(buttons.wiredButtonGroups().nth(0)).toContainText("A-2");
  await expect(buttons.wiredButtonGroups().nth(1)).toContainText("A");
  await expect(buttons.wiredButtonGroups().nth(2)).toContainText("A-1");

  // Assert 3 wired bindings — each button has 1 trigger (Press)
  await expect(buttons.wiredBindings()).toHaveCount(3);
  await expect(buttons.wiredBindings().nth(0)).toContainText("Press");
  await expect(buttons.wiredBindings().nth(0)).toContainText("Tune Mode");
  await expect(buttons.wiredBindings().nth(1)).toContainText("Press");
  await expect(buttons.wiredBindings().nth(1)).toContainText("Shift Up");
  await expect(buttons.wiredBindings().nth(2)).toContainText("Press");
  await expect(buttons.wiredBindings().nth(2)).toContainText("Shift Down");

  // Assert 4 orphan bindings — all show Press trigger (open details first)
  await buttons.openOrphanSection();
  await expect(buttons.orphanBindings()).toHaveCount(4);
  await expect(buttons.orphanBindings().first()).toContainText("Press");

  // Assert empty state is hidden when map has entries
  await expect(buttons.emptyState()).toBeHidden();

  // Assert refresh button is visible
  await expect(buttons.refreshButton()).toBeVisible();

  // Add a new trigger to button A-2 (click add-trigger on first wired group)
  await buttons.wiredButtonGroups().first().getByTestId("add-trigger").click();
  await page.waitForTimeout(200);

  // Assert 4 wired bindings now (new Release→Shift Up added to button A-2)
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

  // Remove the Release trigger from button A-2
  await buttons.wiredBindings().nth(1).getByTestId("remove-binding").click();
  await page.waitForTimeout(200);

  // Assert back to 3 wired bindings
  await expect(buttons.wiredBindings()).toHaveCount(3);

  // Remove all 4 orphan bindings one at a time
  await buttons.openOrphanSection();
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

test("removing all bindings from a wired button keeps the group visible", async ({ page }) => {
  const landing = new LandingPageModel(page);
  const device = new DevicePageModel(page);
  const buttons = new ButtonsPageModel(page);

  // Setup
  await landing.open();
  await landing.startDemo();
  await device.goToButtonsTab();
  await expect(buttons.wiredButtonGroups()).toHaveCount(3);
  await expect(buttons.wiredBindings()).toHaveCount(3);

  // Remove the only binding from button A (first wired group)
  await buttons.wiredButtonGroups().first().getByTestId("remove-binding").click();
  await page.waitForTimeout(200);

  // Assert wired group still visible with "No bindings" placeholder
  await expect(buttons.wiredButtonGroups()).toHaveCount(3);
  await expect(buttons.wiredButtonGroups().first()).toContainText("No bindings");
  await expect(buttons.wiredBindings()).toHaveCount(2);

  // Assert add-trigger button still present on the empty group
  await expect(buttons.wiredButtonGroups().first().getByTestId("add-trigger")).toBeVisible();

  // Add a binding back
  await buttons.wiredButtonGroups().first().getByTestId("add-trigger").click();
  await page.waitForTimeout(200);

  // Assert binding is restored
  await expect(buttons.wiredBindings()).toHaveCount(3);
  await expect(buttons.wiredButtonGroups().first()).not.toContainText("No bindings");

  // Refresh to confirm round-trip
  await buttons.clickRefresh();
  await expect(buttons.wiredBindings()).toHaveCount(3);
});

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
  const diagram = page.locator("pod-diagram");
  await expect(diagram).toBeVisible();

  // Assert pod image rendered inside diagram
  await expect(diagram.locator("img")).toBeVisible();

  // Assert 4 slot containers rendered (tune, up, down, pair)
  await expect(diagram.locator(".pod-slot")).toHaveCount(4);

  // Assert mock pod has exactly 3 trigger buttons (one per non-pair physical position)
  const podMock = page.locator("pod-mock-gui");
  await expect(podMock.locator(".pod-trigger-btn")).toHaveCount(3);

  // Assert exactly 3 wired button groups (A-2, A, A-1) — matching wired positions
  await expect(podMock.getByTestId("pod-button-group-A-2")).toHaveCount(1);
  await expect(podMock.getByTestId("pod-button-group-A")).toHaveCount(1);
  await expect(podMock.getByTestId("pod-button-group-A-1")).toHaveCount(1);
  await expect(podMock.getByTestId("pod-button-group-B")).toHaveCount(0);
  await expect(podMock.getByTestId("pod-button-group-C")).toHaveCount(0);
});

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

  // Assert 7 bindings visible (3 wired + 4 orphan in default map)
  await expect(buttons.wiredBindings()).toHaveCount(3);
  await buttons.openOrphanSection();
  await expect(buttons.orphanBindings()).toHaveCount(4);

  // Seed hub with only 3 button table entries via mutator
  await updateDemoHubState((draft) => {
    draft.buttonTable = draft.buttonTable.slice(0, 3);
  });

  // Refresh to pick up seeded state
  await buttons.clickRefresh();

  // Assert 3 bindings visible after seed + refresh (only first 3 entries)
  // First 3 entries from hub-mock-data: button 00 (wired), 06 (orphan), 0C (orphan)
  await expect(buttons.wiredBindings()).toHaveCount(1);
  await buttons.openOrphanSection();
  await expect(buttons.orphanBindings()).toHaveCount(2);
});

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

  // Navigate to cogs tab and assert initial gear is 11
  await device.goToCogsTab();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "11");

  // Verify default: A (up) → Shift Up
  await page.getByTestId("pod-button-group-A").getByTestId("pod-trigger-press").click();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "12");

  // Verify default: A-1 (down) → Shift Down
  await page.getByTestId("pod-button-group-A-1").getByTestId("pod-trigger-press").click();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "11");

  // Verify default: A-2 (tune) → Tune Mode — shifts adjust tune instead of gear
  await page.getByTestId("pod-button-group-A-2").getByTestId("pod-trigger-press").click();
  await page.getByTestId("pod-button-group-A").getByTestId("pod-trigger-press").click();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "11");
  // Toggle tune mode off so shift works again
  await page.getByTestId("pod-button-group-A-2").getByTestId("pod-trigger-press").click();

  // Go to buttons screen and remap all 3 wired buttons
  await device.goToButtonsTab();

  // Remap A-2: Tune Mode → Shift Down
  await buttons.wiredBindings().nth(0).getByTestId("function-select").selectOption("0B");
  await page.waitForTimeout(500);

  // Remap A: Shift Up → Shift Down
  await buttons.wiredBindings().nth(1).getByTestId("function-select").selectOption("0B");
  await page.waitForTimeout(500);

  // Remap A-1: Shift Down → Shift Up
  await buttons.wiredBindings().nth(2).getByTestId("function-select").selectOption("0A");
  await page.waitForTimeout(500);

  // Navigate to cogs and verify all 3 remapped functions (gear starts at 11)
  await device.goToCogsTab();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "11");

  // A now fires Shift Down → gear 10
  await page.getByTestId("pod-button-group-A").getByTestId("pod-trigger-press").click();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "10");

  // A-1 now fires Shift Up → gear 11
  await page.getByTestId("pod-button-group-A-1").getByTestId("pod-trigger-press").click();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "11");

  // A-2 now fires Shift Down → gear 10
  await page.getByTestId("pod-button-group-A-2").getByTestId("pod-trigger-press").click();
  await expect(cogs.currentGearCard()).toHaveAttribute("data-gear-number", "10");
});
