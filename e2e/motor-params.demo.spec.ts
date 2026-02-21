import { expect, test } from "./fixtures";
import { DeviceMotorPageModel } from "./pages/DeviceMotorPageModel";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";

test.describe("Motor params in demo mode", () => {
  test("shows motor params data and refresh loading state", async ({
    page,
    updateDemoHubState,
    updateDemoDataState,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const motor = new DeviceMotorPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Go to motor params screen
    await device.goToMotorTab();
    await expect(page).toHaveURL(device.motorRouteMatcher());

    // Assert motor tab is active and motor params screen is visible
    await expect(device.motorTabLink()).toHaveAttribute("aria-current", "page");
    await expect(device.motorTabLink()).toHaveClass(/\bactive\b/);
    await expect(motor.root()).toBeVisible();

    // Assert motor params initially load and display expected values
    await expect.poll(async () => motor.paramRows().count()).toBe(7);
    await expect(motor.paramValueByLabel("Stall detection")).toHaveText("2300");
    await expect(motor.paramValueByLabel("PWM frequency")).toHaveText("50000");
    await expect(motor.paramValueByLabel("Accel ramp timer")).toHaveText("30");
    await expect(motor.paramValueByLabel("Ramp start duty")).toHaveText("30");
    await expect(motor.paramValueByLabel("Overshift distance")).toHaveText(
      "0.4",
    );
    await expect(motor.paramValueByLabel("Overshift delay")).toHaveText("500");
    await expect(motor.paramValueByLabel("Multishift delay")).toHaveText("200");

    // Mutate demo seed state (motor data + command delay) before refresh
    await updateDemoHubState((draft) => {
      if (!draft.motorParams?.rawBytes?.length) {
        throw new Error("Expected motor params raw bytes to be available.");
      }
      draft.motorParams.rawBytes[13] = 0x2c;
      draft.motorParams.rawBytes[14] = 0x01;
      draft.motorParams.rawHex = "FC0850C300001E001E0400F4012C01";
      if (draft.motorParams.humanReadable) {
        draft.motorParams.humanReadable.multishiftDelay = 300;
      }
    });

    await updateDemoDataState((draft) => {
      draft.transportDelays.commandExecutionMs = 1200;
    });

    // Click Refresh on Motor params
    await motor.clickRefresh();

    // Assert refresh in-progress indicator is visible while request is pending
    await expect(motor.refreshButtonControl()).toHaveAttribute(
      "aria-busy",
      "true",
    );

    // Assert refresh completed and values are updated from refreshed data
    await expect.poll(async () => motor.paramRows().count()).toBe(7);
    await expect(motor.refreshButtonControl()).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(motor.paramValueByLabel("Multishift delay")).toHaveText("300");
  });
});
