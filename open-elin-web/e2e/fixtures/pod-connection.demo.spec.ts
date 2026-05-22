import { expect, test } from "../fixture";
import { DeviceListPageModel } from "../pages/DeviceListPageModel";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

const POD_MAC = "D5:89:B2:13:FA:04";

test.describe("Pod connection in demo mode", () => {
  test("Full setup: add pod, write button map, pod buttons shift gears", async ({
    page,
    updateDemoDataState,
  }) => {
    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);
    const deviceList = new DeviceListPageModel(page);

    // ---- Setup: clear device list so hub starts empty ----
    await landing.open();
    await landing.startDemo();
    await expect(page).toHaveURL(device.deviceRouteMatcher());

    await updateDemoDataState((draft) => {
      draft.list.entries = [];
    });

    // ---- Navigate to device list ----
    await device.goToListTab();
    await expect(page).toHaveURL(device.listRouteMatcher());

    // Assert list starts empty
    await expect(deviceList.root()).toBeVisible();
    await deviceList.clickRefresh();
    await expect(page.getByTestId("device-list-empty")).toBeVisible();

    // ---- Click Add Pod ----
    await expect(deviceList.addPodButton()).toBeVisible();
    await deviceList.addPodButton().click();

    // Fill in pod MAC
    await expect(deviceList.addPodDialog()).toBeVisible();
    await deviceList.addPodMacInputControl().fill(POD_MAC);
    await deviceList.addPodConfirmButton().click();

    // Pod should now appear in the list
    await expect.poll(async () => deviceList.rows().count()).toBe(1);
    await expect(deviceList.firstRowMac()).toHaveText(POD_MAC);

    // ---- Navigate to buttons page and write default button map ----
    await device.goToButtonsTab();
    await expect(page).toHaveURL(device.buttonsRouteMatcher());

    const writeDefaultButton = page.getByTestId("device-buttons-write-default");
    await expect(writeDefaultButton).toBeVisible();
    await writeDefaultButton.click();

    // Wait for button map to load (entries should appear)
    await expect.poll(
      async () => page.getByTestId("wired-binding").count(),
      { timeout: 5000 },
    ).toBeGreaterThan(0);

    // ---- Press shift-up pod button and assert gear increases ----
    const gearBefore = await page.evaluate(() => {
      const scope = globalThis as typeof globalThis & {
        __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
      };
      return scope.__demo?.hub?.state.get().current.gear ?? 0;
    });

    await device.sidebarShiftUpButton().click();

    await expect.poll(
      async () => {
        return page.evaluate(() => {
          const scope = globalThis as typeof globalThis & {
            __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
          };
          return scope.__demo?.hub?.state.get().current.gear ?? 0;
        });
      },
      { timeout: 3000 },
    ).toBeGreaterThan(gearBefore);

    // ---- Press shift-down pod button and assert gear decreases ----
    const gearMid = await page.evaluate(() => {
      const scope = globalThis as typeof globalThis & {
        __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
      };
      return scope.__demo?.hub?.state.get().current.gear ?? 0;
    });

    await device.sidebarShiftDownButton().click();

    await expect.poll(
      async () => {
        return page.evaluate(() => {
          const scope = globalThis as typeof globalThis & {
            __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
          };
          return scope.__demo?.hub?.state.get().current.gear ?? 0;
        });
      },
      { timeout: 3000 },
    ).toBeLessThan(gearMid);
  });
});
