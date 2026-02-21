import { expect, test } from "../fixture";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Rename hub in demo mode", () => {
  test("renames hub successfully", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Assert initial hub name is visible
    await expect(device.sidebarName()).toHaveText("XSHIFTER ELIN");

    // Open rename dialog
    await device.openRenameDialog();
    await expect(device.renameDialog()).toHaveAttribute("open");

    // Enter a new name and confirm rename
    await device.renameInputControl().fill("Demo Hub Renamed");
    await device.renameConfirmButton().click();

    // Assert rename dialog is closed and sidebar shows updated name
    await expect(device.renameDialog()).not.toHaveAttribute("open");
    await expect(device.sidebarName()).toHaveText("Demo Hub Renamed");
  });

  test("shows validation error when rename is empty", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Open rename dialog
    await device.openRenameDialog();
    await expect(device.renameDialog()).toHaveAttribute("open");

    // Submit empty name
    await device.renameInputControl().fill("");
    await device.renameConfirmButton().click();

    // Assert validation error is shown and dialog remains open
    await expect(device.renameInput()).toHaveAttribute(
      "help-text",
      "Name is required.",
    );
    await expect(device.renameInput()).toHaveAttribute("invalid");
    await expect(device.renameDialog()).toHaveAttribute("open");
  });

  test("shows error when rename command fails for long name", async ({
    page,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Assert initial hub name is visible
    await expect(device.sidebarName()).toHaveText("XSHIFTER ELIN");

    // Open rename dialog
    await device.openRenameDialog();
    await expect(device.renameDialog()).toHaveAttribute("open");

    // Submit a name longer than hub max length
    await device.renameInputControl().fill("NameLongerThanSixteenChars");
    await device.renameConfirmButton().click();

    // Assert command-level rename error is shown and name remains unchanged
    await expect(device.renameInput()).toHaveAttribute(
      "help-text",
      "Rename failed. Try again.",
    );
    await expect(device.renameInput()).toHaveAttribute("invalid");
    await expect(device.renameDialog()).toHaveAttribute("open");
    await expect(device.sidebarName()).toHaveText("XSHIFTER ELIN");
  });
});
