import { expect, test } from "../fixture";
import { DeviceListPageModel } from "../pages/DeviceListPageModel";
import { DeviceLogPageModel } from "../pages/DeviceLogPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Log page in demo mode", () => {
  test("shows events and command logs, and stays pinned to bottom when at bottom", async ({
    page,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const list = new DeviceListPageModel(page);
    const log = new DeviceLogPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Run a command to ensure command logging is present
    await device.goToListTab();
    await expect(page).toHaveURL(device.listRouteMatcher());
    await list.clickRefresh();

    // Go to log screen
    await device.goToLogTab();
    await expect(page).toHaveURL(device.logRouteMatcher());
    await expect(device.logTabLink()).toHaveAttribute("aria-current", "page");
    await expect(log.root()).toBeVisible();

    // Assert it shows all event/command categories we triggered
    await expect.poll(async () => log.text()).toContain("Get list...");
    await expect.poll(async () => log.text()).toContain("Get list result");

    // Add a burst of incoming events and ensure they appear in log
    for (let index = 0; index < 12; index += 1) {
      await device.sidebarShiftUpButton().click();
    }
    await expect.poll(async () => log.text()).toContain("Button action");
    await expect.poll(async () => log.text()).toContain("Shift complete");

    // Ensure the latest log lines are at the bottom and autoscroll stays pinned
    await log.scrollToBottom();
    await expect.poll(async () => log.isAtBottom()).toBe(true);
    const linesBefore = await log.lineCount();

    await device.sidebarShiftDownButton().click();

    await expect.poll(async () => log.lineCount()).toBeGreaterThan(linesBefore);
    await expect.poll(async () => log.isAtBottom()).toBe(true);
  });

  test("keeps scroll position when user is not at bottom and new lines arrive", async ({
    page,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const log = new DeviceLogPageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Go to log screen
    await device.goToLogTab();
    await expect(page).toHaveURL(device.logRouteMatcher());
    await expect(log.root()).toBeVisible();

    // Generate enough log lines to make log scrollable
    for (let index = 0; index < 24; index += 1) {
      await device.sidebarShiftUpButton().click();
    }
    await expect.poll(async () => log.lineCount()).toBeGreaterThan(10);

    // Scroll away from bottom
    await log.scrollToTop();
    await expect.poll(async () => log.isAtBottom()).toBe(false);
    const scrollTopBefore = await log.scrollTop();

    // Trigger new incoming data while not at bottom
    await device.sidebarShiftDownButton().click();

    // Assert scroll position stays where user left it
    await expect.poll(async () => log.scrollTop()).toBe(scrollTopBefore);
    await expect.poll(async () => log.isAtBottom()).toBe(false);
  });
});
