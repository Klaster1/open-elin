import { expect, test } from "../fixture";
import { DeviceListPageModel } from "../pages/DeviceListPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Sleep flow in demo mode", () => {
  test("returns to landing page after sleep", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const deviceList = new DeviceListPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Go to device list screen
    await device.goToListTab();
    await expect(page).toHaveURL(device.listRouteMatcher());

    // Click sleep on hub card and assert return to landing page
    await deviceList.hubSleepButton().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(landing.root()).toBeVisible();
  });
});
