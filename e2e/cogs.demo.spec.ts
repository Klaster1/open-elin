import { expect, test } from "@playwright/test";

import { CogsPageModel } from "./pages/CogsPageModel";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";

test.describe("Cogs in demo mode", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("covers demo entry and cogs interactions", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const cogs = new CogsPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Go to cogs screen
    await device.goToCogsTab();
    await expect(page).toHaveURL(device.cogsRouteMatcher());
    await expect(device.cogsTabLink()).toHaveAttribute("aria-current", "page");
    await expect(device.cogsTabLink()).toHaveClass(/\bactive\b/);
    await expect(cogs.root()).toBeVisible();
    await expect(cogs.heading()).toBeVisible();

    await cogs.getRearCogInfo();
    await cogs.getPosition();

    // Assert device displays 12 cogs
    await expect(cogs.gearStrip()).toBeVisible();
    await expect.poll(async () => cogs.gearCount()).toBe(12);

    // Assert each cog displays index, teeth count
    for (let index = 0; index < 12; index += 1) {
      await expect(cogs.gearNumberInCard(index)).toHaveText(`${index + 1}`);
      await expect(cogs.gearTeethInCard(index)).toHaveText(/\d+T/);
    }

    // Assert current cog is marked with arrow and shows precise offset
    await expect(cogs.currentGearArrow()).toBeVisible();
    await expect(await cogs.currentGearOffsetMode()).toBe("precise");

    // Assert all other cogs show approximate offset
    const nonCurrentCount = await cogs.nonCurrentGearCards().count();
    for (let index = 0; index < nonCurrentCount; index += 1) {
      await expect(await cogs.nonCurrentGearOffsetMode(index)).toBe("approx");
    }

    const gearBeforeShiftDown = await cogs.currentGearNumber();
    const expectedGearAfterShiftDown = gearBeforeShiftDown - 1;

    // Shift down
    await cogs.shiftDown();

    // Assert gear shifted and new current gear has precise offset shown
    await expect
      .poll(async () => cogs.currentGearNumber(), {
        message: `Expected gear ${expectedGearAfterShiftDown} after shift down`,
      })
      .toBe(expectedGearAfterShiftDown);
    await expect(await cogs.currentGearOffsetMode()).toBe("precise");

    const gearBeforeShiftUpTwice = await cogs.currentGearNumber();
    const expectedGearAfterShiftUpTwice = gearBeforeShiftUpTwice + 2;

    // Shift up twice, assert that gear now shows precise offset too
    await cogs.shiftUp();
    await cogs.shiftUp();
    await expect
      .poll(async () => cogs.currentGearNumber(), {
        message: `Expected gear ${expectedGearAfterShiftUpTwice} after shifting up twice`,
      })
      .toBe(expectedGearAfterShiftUpTwice);
    await expect(await cogs.currentGearOffsetMode()).toBe("precise");

    // Check that each tune button adjusts position in correct direction
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(23, 3);

    await cogs.tuneDecrease10Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(13, 3);

    await cogs.tuneDecrease5Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(8, 3);

    await cogs.tuneDecrease1Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(7, 3);

    await cogs.tuneDecreaseSmallButton().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(6.9, 3);

    await cogs.tuneIncrease01Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(7, 3);

    await cogs.tuneIncrease1Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(8, 3);

    await cogs.tuneIncrease5Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(13, 3);

    await cogs.tuneIncrease10Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(23, 3);

    // In sidebar shift all the way up and then all the way down
    const totalGears = await cogs.gearCount();
    for (let index = 0; index < totalGears; index += 1) {
      await device.sidebarShiftUpButton().click();
    }
    await expect.poll(async () => cogs.currentGearNumber()).toBe(totalGears);

    for (let index = 1; index < totalGears; index += 1) {
      await device.sidebarShiftDownButton().click();
    }
    await expect.poll(async () => cogs.currentGearNumber()).toBe(1);

    // Assert all cogs now show precise value.
    for (let index = 0; index < totalGears; index += 1) {
      await expect(await cogs.gearOffsetMode(index)).toBe("precise");
    }
  });
});
