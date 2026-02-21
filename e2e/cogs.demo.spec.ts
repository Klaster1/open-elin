import { expect, test } from "./fixtures";
import { CogsPageModel } from "./pages/CogsPageModel";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";

test.describe("Cogs in demo mode", () => {
  test("covers demo entry and cogs interactions", async ({
    page,
    updateDemoHubState,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const cogs = new CogsPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    await updateDemoHubState((draft) => {
      draft.rearCogs.approximate = [1, 3, 5, 7, 9, 30, 33, 36, 39, 42, 45];
      draft.rearCogs.precise = [
        1.1, 3.1, 5.1, 7.1, 9.5, 30, 33.2, 36.2, 39.2, 42.2, 45.2,
      ];
      draft.rearCogs.teeth = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
      draft.current.gear = 5;
      draft.current.offset = 9.5;
    });

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

    // Assert device displays 11 cogs
    await expect(cogs.gearStrip()).toBeVisible();
    await expect.poll(async () => cogs.gearCount()).toBe(11);

    await expect.poll(async () => cogs.currentGearNumber()).toBe(5);

    // Assert each cog displays index, teeth count
    for (let index = 0; index < 11; index += 1) {
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

    // Shift down
    await cogs.shiftDown();

    // Assert gear shifted and new current gear has precise offset shown
    await expect
      .poll(async () => cogs.currentGearNumber(), {
        message: "Expected gear 4 after shift down",
      })
      .toBe(4);
    await expect(await cogs.currentGearOffsetMode()).toBe("precise");

    // Shift up twice, assert that gear now shows precise offset too
    await cogs.shiftUp();
    await cogs.shiftUp();
    await expect
      .poll(async () => cogs.currentGearNumber(), {
        message: "Expected gear 6 after shifting up twice",
      })
      .toBe(6);
    await expect(await cogs.currentGearOffsetMode()).toBe("precise");

    // Check that each tune button adjusts position in correct direction
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(30, 3);

    await cogs.tuneDecrease10Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(20, 3);

    await cogs.tuneDecrease5Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(15, 3);

    await cogs.tuneDecrease1Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(14, 3);

    await cogs.tuneDecreaseSmallButton().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(13.9, 3);

    await cogs.tuneIncrease01Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(14, 3);

    await cogs.tuneIncrease1Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(15, 3);

    await cogs.tuneIncrease5Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(20, 3);

    await cogs.tuneIncrease10Button().click();
    await expect
      .poll(async () => cogs.currentGearOffsetValue())
      .toBeCloseTo(30, 3);

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

  test("saves, applies, removes profiles and locks cogs operations during apply", async ({
    page,
    updateDemoHubState,
    updateDemoDataState,
  }) => {
    // Go to app
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const cogs = new CogsPageModel(page);

    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();

    // Seed deterministic cog data before entering cogs
    await updateDemoHubState((draft) => {
      draft.rearCogs.approximate = [1.2, 3.0, 4.7];
      draft.rearCogs.precise = [1.2, 3.1, 4.8];
      draft.rearCogs.teeth = [11, 13, 15];
      draft.current.gear = 2;
      draft.current.offset = 3.1;
    });

    // Go to cogs screen
    await device.goToCogsTab();

    // Assert profiles section and empty state are visible, and empty-state save action is disabled
    await expect(cogs.profilesSection()).toBeVisible();
    await expect(cogs.profilesEmptyState()).toBeVisible();
    await expect(cogs.saveProfileButtonInEmptyState()).toHaveAttribute(
      "disabled",
      "",
    );

    await cogs.shiftDown();
    await cogs.shiftUp();
    await cogs.shiftUp();

    // Assert empty-state save action becomes enabled after collecting precise values
    // Save profile and assert row appears with expected teeth/offset table values
    await expect(cogs.saveProfileButtonInEmptyState()).not.toHaveAttribute(
      "disabled",
      "",
    );

    await cogs.saveProfileButtonInEmptyState().click();
    await expect(cogs.profileDialog()).toBeVisible();
    await cogs.fillProfileDialogInput("Race");
    await cogs.profileDialogConfirmButton().click();

    await expect(cogs.profilesList()).toBeVisible();
    await expect(cogs.profileRowByName("Race")).toBeVisible();
    await expect(cogs.profileOffsets("Race")).toContainText([
      "1.20",
      "3.10",
      "4.80",
    ]);
    await expect(cogs.profileTeeth("Race")).toContainText([
      "11T",
      "13T",
      "15T",
    ]);

    // Assert duplicate profile name shows validation error in save dialog
    await cogs.saveProfileButton().click();
    await expect(cogs.profileDialog()).toBeVisible();
    await cogs.fillProfileDialogInput("Race");
    await cogs.profileDialogConfirmButton().click();
    await expect(cogs.profileDialog()).toContainText(
      "Profile name must be unique",
    );
    await cogs.profileDialogCancelButton().click();

    // Reload page and assert saved profile row is restored from storage
    await page.goto("/");
    await expect(landing.root()).toBeVisible();
    await landing.startDemo();
    await device.goToCogsTab();
    await expect(cogs.profileRowByName("Race")).toBeVisible();

    // Seed a different hub cog dataset and assert it is reflected after refresh
    await updateDemoHubState((draft) => {
      draft.rearCogs.approximate = [6.1, 7.2, 8.3];
      draft.rearCogs.precise = [6.1, 7.2, 8.3];
      draft.rearCogs.teeth = [22, 24, 26];
      draft.current.gear = 2;
      draft.current.offset = 7.2;
    });

    await cogs.getRearCogInfo();
    await cogs.getPosition();
    await expect(cogs.gearTeethInCard(0)).toHaveText("22T");

    // Slow command execution to make apply-lock state observable
    // Assert cogs controls and profile actions are disabled while apply is in progress
    await updateDemoDataState((draft) => {
      draft.transportDelays.commandExecutionMs = 180;
    });

    const applyPromise = cogs.profileApplyButton("Race").click();
    await expect(cogs.profileApplyingStatus()).toBeVisible();

    await expect(cogs.getRearCogInfoButton()).toHaveAttribute("disabled", "");
    await expect(cogs.getPositionButton()).toHaveAttribute("disabled", "");
    await expect(cogs.shiftDownButton()).toHaveAttribute("disabled", "");
    await expect(cogs.shiftUpButton()).toHaveAttribute("disabled", "");
    await expect(cogs.tuneDecrease10Button()).toHaveAttribute("disabled", "");
    await expect(cogs.tuneIncrease10Button()).toHaveAttribute("disabled", "");
    await expect(cogs.saveProfileButton()).toHaveAttribute("disabled", "");
    await expect(cogs.profileApplyButton("Race")).toHaveAttribute(
      "disabled",
      "",
    );
    await expect(cogs.profileRemoveButton("Race")).toHaveAttribute(
      "disabled",
      "",
    );

    // Assert apply completes and restores saved teeth values after readback
    await applyPromise;

    await expect(cogs.profileApplyingStatus()).toBeHidden();
    await expect(cogs.gearTeethInCard(0)).toHaveText("11T");
    await expect(cogs.gearTeethInCard(1)).toHaveText("13T");
    await expect(cogs.gearTeethInCard(2)).toHaveText("15T");

    // Assert removed profile row no longer exists
    await cogs.profileRemoveButton("Race").click();
    await expect(cogs.profileRowByName("Race")).toHaveCount(0);
  });
});
