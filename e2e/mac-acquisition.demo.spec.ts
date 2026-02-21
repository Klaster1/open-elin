import { expect, test } from "./fixtures";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";
import { MacPageModel } from "./pages/MacPageModel";

test.describe("MAC acquisition in demo full mode", () => {
  test("manual MAC entry on /mac routes to device page", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const macPage = new MacPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Hold Alt to enable full demo path
    await landing.holdAltForDemoFull();
    await expect(landing.demoButton()).toHaveText("Demo (full)");

    // Start full demo and release Alt
    await landing.startDemo();
    await landing.releaseAltForDemoFull();
    await expect(page).toHaveURL(landing.macRouteMatcher());
    await expect(macPage.root()).toBeVisible();

    // Apply manual MAC and assert route progression
    await macPage.manualInputControl().fill("02:11:22:33:44:55");
    await macPage.manualApplyButton().click();
    await expect(page).toHaveURL(device.deviceRouteMatcher());
    await expect(device.sidebarMac()).toHaveText("02:11:22:33:44:55");
  });

  test("shift complete on /mac routes to device page", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const macPage = new MacPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Hold Alt to enable full demo path
    await landing.holdAltForDemoFull();
    await expect(landing.demoButton()).toHaveText("Demo (full)");

    // Start full demo and release Alt
    await landing.startDemo();
    await landing.releaseAltForDemoFull();
    await expect(page).toHaveURL(landing.macRouteMatcher());
    await expect(macPage.root()).toBeVisible();

    // Trigger shift-complete via demo pod controls and assert route progression
    await expect(macPage.podControls()).toBeVisible();
    await macPage.podShiftUpButton().click();
    await expect(page).toHaveURL(device.deviceRouteMatcher());
    await expect(device.sidebarMac()).toHaveText("02:11:22:33:44:55");
  });
});
