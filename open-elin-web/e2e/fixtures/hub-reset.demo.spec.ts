import { expect, test } from "../fixture";
import { ButtonsPageModel } from "../pages/ButtonsPageModel";
import { CogsPageModel } from "../pages/CogsPageModel";
import { DeviceListPageModel } from "../pages/DeviceListPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("Hub reset in demo mode", () => {
  test("Full reset flow: hub state goes back to defaults", async ({ page }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const deviceList = new DeviceListPageModel(page);
    const buttons = new ButtonsPageModel(page);
    const cogs = new CogsPageModel(page);

    // ---- 1. Start demo ----
    await landing.open();
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    // ---- 2. Verify initial state via GUI ----

    // Device list: pod is present
    await device.goToListTab();
    await deviceList.clickRefresh();
    await expect(deviceList.rows()).toHaveCount(1);
    await expect(deviceList.firstRowMac()).toHaveText("D5:89:B2:13:FA:04");

    // Buttons: default button table loaded (3 wired + 4 orphan bindings)
    await device.goToButtonsTab();
    await expect(buttons.podGroups()).toHaveCount(1);
    await expect(buttons.wiredBindings()).toHaveCount(3);
    await buttons.openOrphanSection();
    await expect(buttons.orphanBindings()).toHaveCount(4);

    // Cogs: 12 gear cards, gear 11 is current with precise offset 21.10
    await device.goToCogsTab();
    await cogs.getRearCogInfo();
    await cogs.getPosition();
    await expect(cogs.gearCards()).toHaveCount(12);
    await expect(cogs.gearCardByNumber(11)).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(cogs.gearOffsetByNumber(11)).toHaveText("21.10");

    // Sidebar shows the default hub name
    await expect(device.sidebarName()).toHaveText("XSHIFTER ELIN");

    // ---- 3. Mutate state via GUI ----

    // 3a. Rename the hub via device list hub card
    await device.goToListTab();
    await deviceList.openRenameDialog();
    await deviceList.renameInputControl().fill("TESTED HUB");
    await deviceList.renameConfirmButton().click();
    await expect(deviceList.hubCardName()).toHaveText("TESTED HUB");
    await expect(device.sidebarName()).toHaveText("TESTED HUB");

    // 3b. Tune-shift the current cog by +1 -> precise offset shifts to 22.10
    await device.goToCogsTab();
    await cogs.tuneIncrease1Button().click();
    await expect(cogs.gearOffsetByNumber(11)).toHaveText("22.10");

    // 3c. Shift down twice -> current gear moves 11 -> 10 -> 9
    await cogs.shiftDown();
    await expect(cogs.gearCardByNumber(10)).toHaveAttribute(
      "data-current",
      "true",
    );
    await cogs.shiftDown();
    await expect(cogs.gearCardByNumber(9)).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(cogs.gearCardByNumber(11)).toHaveAttribute(
      "data-current",
      "false",
    );

    // ---- 4. Click hub reset (via mock GUI) ----
    await device.resetHubViaMockGui();

    // ---- 5. Current screen (cogs) must NOT auto-update ----
    // Gear 9 is still marked current (pre-reset), and gear 11's tuned offset
    // (22.10) is still visible -> the UI displays stale data until refreshed.
    // The renamed hub name is also still shown in the sidebar (no auto-read).
    await expect(cogs.gearCardByNumber(9)).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(cogs.gearOffsetByNumber(11)).toHaveText("22.10");
    await expect(device.sidebarName()).toHaveText("TESTED HUB");

    // ---- 6. Manually refresh each datum and verify reset ----

    // Cogs: get rear cog info -> tuned precise offset is cleared, only the
    // default approximate offset (21.20) remains. If precise leaked across
    // reset, this would still read 22.10.
    await cogs.getRearCogInfo();
    await expect(cogs.gearOffsetByNumber(11)).toHaveText("21.20");
    await expect(cogs.gearOffsetByNumber(11)).toHaveAttribute(
      "data-offset-mode",
      "approx",
    );

    // Cogs: get position -> gear 1 is now current
    await cogs.getPosition();
    await expect(cogs.gearCardByNumber(1)).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(cogs.gearCardByNumber(9)).toHaveAttribute(
      "data-current",
      "false",
    );
    await expect(cogs.gearCardByNumber(11)).toHaveAttribute(
      "data-current",
      "false",
    );

    // Device list: refresh -> empty (real hub has no paired pods after reset)
    await device.goToListTab();
    await deviceList.clickRefresh();
    await expect(deviceList.emptyState()).toBeVisible();
    await expect(deviceList.rows()).toHaveCount(0);

    // Buttons: refresh -> empty (button table cleared on hub)
    await device.goToButtonsTab();
    await buttons.clickRefresh();
    await expect(buttons.podGroups()).toHaveCount(0);
    await expect(buttons.emptyState()).toBeVisible();

    // Hub name: only a fresh connection re-reads the device name from the
    // hub. Disconnect + restart demo -> sidebar shows the default name.
    await device.disconnect();
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());
    await expect(device.sidebarName()).toHaveText("XSHIFTER ELIN");
  });
});
