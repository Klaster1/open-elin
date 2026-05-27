import { expect, test } from "../fixture";
import { DeviceListPageModel } from "../pages/DeviceListPageModel";
import { ConsolePanelModel } from "../pages/ConsolePanelModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Console panel in demo mode", () => {
  test("shows events and command logs, and stays pinned to bottom when at bottom", async ({
    page,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const list = new DeviceListPageModel(page);
    const console = new ConsolePanelModel(page);

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

    // Open console panel
    await device.toggleConsole();
    await expect(console.root()).toBeVisible();

    // Assert it shows all event/command categories we triggered
    await expect.poll(async () => console.text()).toContain("Get list...");
    await expect.poll(async () => console.text()).toContain("Get list result");

    // Add a burst of incoming events and ensure they appear in log
    for (let index = 0; index < 12; index += 1) {
      await device.sidebarShiftUpButton().click();
    }
    await expect.poll(async () => console.text()).toContain("Button action");
    await expect.poll(async () => console.text()).toContain("Shift complete");

    // Ensure the latest log lines are at the bottom and autoscroll stays pinned
    await console.scrollToBottom();
    await expect.poll(async () => console.isAtBottom()).toBe(true);
    const linesBefore = await console.lineCount();

    await device.sidebarShiftDownButton().click();

    await expect.poll(async () => console.lineCount()).toBeGreaterThan(linesBefore);
    await expect.poll(async () => console.isAtBottom()).toBe(true);
  });

  test("keeps scroll position when user is not at bottom and new lines arrive", async ({
    page,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const console = new ConsolePanelModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start demo mode
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // Open console panel
    await device.toggleConsole();
    await expect(console.root()).toBeVisible();

    // Generate enough log lines to make log scrollable
    for (let index = 0; index < 24; index += 1) {
      await device.sidebarShiftUpButton().click();
    }
    await expect.poll(async () => console.lineCount()).toBeGreaterThan(10);

    // Scroll away from bottom
    await console.scrollToTop();
    await expect.poll(async () => console.isAtBottom()).toBe(false);
    const scrollTopBefore = await console.scrollTop();

    // Trigger new incoming data while not at bottom
    await device.sidebarShiftDownButton().click();

    // Assert scroll position stays where user left it
    await expect.poll(async () => console.scrollTop()).toBe(scrollTopBefore);
    await expect.poll(async () => console.isAtBottom()).toBe(false);
  });
});
