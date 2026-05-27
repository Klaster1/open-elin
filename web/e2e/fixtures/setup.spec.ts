import { expect, test } from "../fixture";
import { CogsPageModel } from "../pages/CogsPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";
import { SetupPageModel } from "../pages/SetupPageModel";

test.describe("Setup in demo mode", () => {
  test("covers setup flow in one fast path", async ({
    page,
    updateDemoHubState,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const setup = new SetupPageModel(page);
    const cogs = new CogsPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Seed deterministic current position before opening Setup tab
    await updateDemoHubState((draft) => {
      draft.current.gear = 3;
      draft.current.offset = 42.2;
    });

    // Go to setup screen
    await device.goToSetupTab();
    await expect(page).toHaveURL(device.setupRouteMatcher());

    // Assert setup tab is active and setup screen is visible
    await expect(device.setupTabLink()).toHaveAttribute("aria-current", "page");
    await expect(device.setupTabLink()).toHaveClass(/\bactive\b/);
    await expect(setup.root()).toBeVisible();
    await expect(setup.heading()).toBeVisible();

    // Start setup
    await setup.startSetup();
    await expect(setup.setupModePending()).toBeVisible();
    await expect(setup.stepPanel(1)).toBeVisible();

    // Assert Step 1 defaults:
    // - cog count default is 12
    await expect(setup.cogCountSelect()).toHaveAttribute("value", "12");

    // - allowed range is 5..14
    const optionValues = await setup.cogCountSelect().evaluate((node) => {
      const host = node as HTMLElement;
      return Array.from(host.querySelectorAll("sl-option")).map((option) => {
        const value = (option as HTMLOptionElement).getAttribute("value") ?? "";
        return Number(value);
      });
    });
    expect(optionValues).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

    // - tooth inputs default to 0
    await expect.poll(async () => setup.cassetteToothInputs().count()).toBe(12);
    for (let cogIndex = 1; cogIndex <= 12; cogIndex += 1) {
      await expect(setup.cassetteToothInputByCog(cogIndex)).toHaveAttribute(
        "value",
        "0",
      );
    }

    // - tooth list and preview rows resize on grow and shrink
    await setup.cogCountSelect().evaluate((node) => {
      const select = node as HTMLElement & { value: string };
      select.value = "14";
      select.dispatchEvent(
        new CustomEvent("sl-change", { bubbles: true, composed: true }),
      );
    });
    await expect.poll(async () => setup.cassetteToothInputs().count()).toBe(14);
    await expect.poll(async () => setup.previewGearValues().count()).toBe(14);

    await setup.cogCountSelect().evaluate((node) => {
      const select = node as HTMLElement & { value: string };
      select.value = "11";
      select.dispatchEvent(
        new CustomEvent("sl-change", { bubbles: true, composed: true }),
      );
    });
    await expect.poll(async () => setup.cassetteToothInputs().count()).toBe(11);
    await expect.poll(async () => setup.previewGearValues().count()).toBe(11);

    // Set custom tooth values for persistence checks
    await setup.cassetteToothInputByCog(1).locator("input").fill("11");
    await setup.cassetteToothInputByCog(2).locator("input").fill("12");
    await setup.cassetteToothInputByCog(3).locator("input").fill("13");

    // Assert Step 2 behavior:
    await setup.continueFromStep1();
    await expect(setup.stepPanel(2)).toBeVisible();

    // - smallest initializes from seeded current position
    await expect(setup.smallestOffsetValue()).toHaveText("42.20");
    await expect(setup.previewOffsetValues().first()).toHaveText("42.20");

    // - first preview offset updates live while tuning smallest
    await setup.smallestTuneIncreaseButton("1").click();
    await expect(setup.smallestOffsetValue()).toHaveText("43.20");
    await expect(setup.previewOffsetValues().first()).toHaveText("43.20");

    // Assert Step 3 behavior:
    await setup.continueFromStep2();
    await expect(setup.stepPanel(3)).toBeVisible();

    // - largest initializes from smallest
    await expect(setup.largestOffsetValue()).toHaveText("43.20");

    // - validation is shown when largest <= smallest
    await expect(setup.offsetError()).toHaveText(
      "Largest cog offset must be greater than smallest cog offset.",
    );

    // - Write to NXS stays disabled until interpolation is valid
    await expect(setup.writeButton()).toHaveAttribute("disabled", "");

    // - interpolation row updates live while tuning largest
    const interpolationFirstBefore = (
      await setup.previewOffsetValues().nth(1).innerText()
    ).trim();
    await setup.largestTuneIncreaseButton("10").click();
    await expect(setup.largestOffsetValue()).toHaveText("53.20");
    await expect(setup.previewOffsetValues().last()).toHaveText("53.20");
    await expect
      .poll(async () => {
        return (await setup.previewOffsetValues().nth(1).innerText()).trim();
      })
      .not.toBe(interpolationFirstBefore);

    // - bounds enforcement blocks below-min and above-max
    for (let index = 0; index < 40; index += 1) {
      await setup.largestTuneIncreaseButton("10").click();
    }
    await expect(setup.largestOffsetValue()).toHaveText("250.00");

    // - successful write advances to Step 4
    await expect(setup.writeButton()).toBeEnabled();
    await setup.writeToNxs();
    await expect(setup.stepPanel(4)).toBeVisible();

    // Assert finish behavior:
    // - Go to Cogs link points to /device/:mac/cogs
    await expect(setup.finishGoCogsLink()).toHaveAttribute(
      "href",
      /\/device\/[A-F0-9-]+\/cogs$/,
    );

    // - save profile dialog opens and saves setup entries
    const profileName = "Setup Fast 11";
    await setup.openSaveProfileDialog();
    await expect(setup.profileDialog()).toBeVisible();
    await setup.profileDialogInput().locator("input").fill(profileName);
    await setup.profileDialogConfirmButton().click();

    // - save redirects to Cogs and new profile row is visible
    await expect(page).toHaveURL(device.cogsRouteMatcher());
    await expect(cogs.profileRowByName(profileName)).toBeVisible();

    // - custom tooth values persist
    await expect(cogs.profileTeeth(profileName)).toContainText([
      "11T",
      "12T",
      "13T",
    ]);

    // - Cogs shows precise per-cog offsets from setup after redirect
    await expect.poll(async () => cogs.gearCount()).toBe(11);
    for (let index = 0; index < 11; index += 1) {
      await expect(await cogs.gearOffsetMode(index)).toBe("precise");
    }
  });
});
