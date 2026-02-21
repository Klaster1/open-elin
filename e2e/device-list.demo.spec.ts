import { expect, test } from "./fixtures";
import { DeviceListPageModel } from "./pages/DeviceListPageModel";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";

test.describe("Device list in demo mode", () => {
  test("shows list data and refresh applies seeded mutation", async ({
    page,
    updateDemoDataState,
  }) => {
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

    // Assert list tab is active and device list screen is visible
    await expect(device.listTabLink()).toHaveAttribute("aria-current", "page");
    await expect(device.listTabLink()).toHaveClass(/\bactive\b/);
    await expect(deviceList.root()).toBeVisible();

    // Assert list initially loads and shows at least one row
    await expect.poll(async () => deviceList.rows().count()).toBe(1);

    // Assert first row shows expected fields:
    // - device name
    // - MAC
    // - device id
    // - battery
    // - RSSI
    // - connection status
    await expect(deviceList.firstRowName()).toHaveText("NXS MTB Pod");
    await expect(deviceList.firstRowMac()).toHaveText("D5:89:B2:13:FA:04");
    await expect(deviceList.firstRowDeviceId()).toHaveText("10");
    await expect(deviceList.firstRowBattery()).toHaveText("3.09 V (3086 mV)");
    await expect(deviceList.firstRowRssi()).toHaveText("178");
    await expect(deviceList.firstRowStatus()).toHaveText("Connected");

    // Mutate demo seed state (list battery + command delay) via fixture mutator before refresh
    await updateDemoDataState((draft) => {
      if (!draft.list.entries.length) {
        throw new Error("Expected at least one demo list entry to mutate.");
      }
      draft.list.entries[0].batteryVoltage = 3210;
      draft.transportDelays.commandExecutionMs = 1200;
    });

    // Click Refresh on Device list
    await deviceList.clickRefresh();

    // Assert refresh in-progress indicator is visible while request is pending
    await expect(deviceList.refreshButtonControl()).toHaveAttribute(
      "aria-busy",
      "true",
    );

    // Assert refresh completed and list is rendered again
    await expect.poll(async () => deviceList.rows().count()).toBe(1);
    await expect(deviceList.refreshButtonControl()).toHaveAttribute(
      "aria-busy",
      "false",
    );

    // Assert battery value changed to expected new value after refresh
    await expect(deviceList.firstRowBattery()).toHaveText("3.21 V (3210 mV)");

    // Assert non-battery fields remain stable after refresh:
    // - device name unchanged
    // - MAC unchanged
    // - device id unchanged
    // - connection status unchanged
    await expect(deviceList.firstRowName()).toHaveText("NXS MTB Pod");
    await expect(deviceList.firstRowMac()).toHaveText("D5:89:B2:13:FA:04");
    await expect(deviceList.firstRowDeviceId()).toHaveText("10");
    await expect(deviceList.firstRowStatus()).toHaveText("Connected");
  });
});
