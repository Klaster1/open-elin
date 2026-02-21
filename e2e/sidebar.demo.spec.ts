import { expect, test } from "./fixtures";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";

test.describe("Sidebar in demo mode", () => {
  test("shows MAC and battery, and battery status updates over time", async ({
    page,
    updateDemoDataState,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Seed fast battery update interval before starting demo
    await updateDemoDataState((draft) => {
      draft.transportDelays.batteryIntervalMs = 100;
    });

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Assert sidebar MAC and battery are visible
    await expect(device.sidebarMac()).toHaveText("02:11:22:33:44:55");
    await expect(device.sidebarBatteryStatus()).toBeVisible();

    // Assert battery reaches known initial hub value
    await expect
      .poll(async () =>
        (await device.sidebarBatteryStatus().innerText()).trim(),
      )
      .toMatch(/Battery 4\.13 V • 9[23]%/);

    // Mutate hub battery notification sample so next updates change sidebar battery
    await updateDemoDataState((draft) => {
      for (const sample of draft.batteryNotifications) {
        if (sample.targetMac === "02:11:22:33:44:55") {
          sample.rawHex = "100E";
        }
      }
    });

    // Assert battery status updates to new value
    await expect
      .poll(async () =>
        (await device.sidebarBatteryStatus().innerText()).trim(),
      )
      .toBe("Battery 3.60 V • 40%");
  });
});
