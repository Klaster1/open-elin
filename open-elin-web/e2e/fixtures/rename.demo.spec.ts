import { expect, test } from "../fixture";
import { DeviceListPageModel } from "../pages/DeviceListPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Rename hub in demo mode", () => {
  test("renames hub successfully", async ({ page }) => {
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

    // Assert initial hub name is visible on hub card
    await expect(deviceList.hubCardName()).toHaveText("XSHIFTER ELIN");

    // Open rename dialog from hub card
    await deviceList.openRenameDialog();
    await expect(deviceList.renameDialog()).toHaveAttribute("open");

    // Enter a new name and confirm rename
    await deviceList.renameInputControl().fill("Demo Hub Renamed");
    await deviceList.renameConfirmButton().click();

    // Assert rename dialog is closed and hub card + sidebar show updated name
    await expect(deviceList.renameDialog()).not.toHaveAttribute("open");
    await expect(deviceList.hubCardName()).toHaveText("Demo Hub Renamed");
    await expect(device.sidebarName()).toHaveText("Demo Hub Renamed");
  });

  test("shows validation error when rename is empty", async ({ page }) => {
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

    // Open rename dialog from hub card
    await deviceList.openRenameDialog();
    await expect(deviceList.renameDialog()).toHaveAttribute("open");

    // Submit empty name
    await deviceList.renameInputControl().fill("");
    await deviceList.renameConfirmButton().click();

    // Assert validation error is shown and dialog remains open
    await expect(deviceList.renameInput()).toHaveAttribute(
      "help-text",
      "Name is required.",
    );
    await expect(deviceList.renameInput()).toHaveAttribute("invalid");
    await expect(deviceList.renameDialog()).toHaveAttribute("open");
  });

  test("shows error when rename command fails for long name", async ({
    page,
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

    // Assert initial hub name is visible on hub card
    await expect(deviceList.hubCardName()).toHaveText("XSHIFTER ELIN");

    // Open rename dialog from hub card
    await deviceList.openRenameDialog();
    await expect(deviceList.renameDialog()).toHaveAttribute("open");

    // Submit a name longer than hub max length
    await deviceList.renameInputControl().fill("NameLongerThanSixteenChars");
    await deviceList.renameConfirmButton().click();

    // Assert command-level rename error is shown and name remains unchanged
    await expect(deviceList.renameInput()).toHaveAttribute(
      "help-text",
      "Rename failed. Try again.",
    );
    await expect(deviceList.renameInput()).toHaveAttribute("invalid");
    await expect(deviceList.renameDialog()).toHaveAttribute("open");
    await expect(deviceList.hubCardName()).toHaveText("XSHIFTER ELIN");
  });
});
