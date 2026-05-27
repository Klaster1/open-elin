import { expect, test } from "../fixture";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Disconnect flow in demo mode", () => {
  test("returns to landing page after disconnect", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode and ensure device page is open
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());
    await expect(device.sidebarMac()).toHaveText("02:11:22:33:44:55");

    // Disconnect and assert return to landing page
    await device.disconnect();
    await expect(page).toHaveURL(/\/$/);
    await expect(landing.root()).toBeVisible();
    await expect(landing.demoButton()).toHaveText("Demo");
  });
});
