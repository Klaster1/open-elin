import { expect, test } from "./fixtures";
import { CogsPageModel } from "./pages/CogsPageModel";
import { DevicePageModel } from "./pages/DevicePageModel";
import { LandingPageModel } from "./pages/LandingPageModel";

test.describe("Cog profiles in demo mode", () => {
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
