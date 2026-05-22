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
});
