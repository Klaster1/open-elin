# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fixtures\pod-connection.demo.spec.ts >> Pod connection in demo mode >> Full setup: add pod, write button map, pod buttons shift gears
- Location: e2e\fixtures\pod-connection.demo.spec.ts:9:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('device-list-add-pod')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByTestId('device-list-add-pod')

```

```yaml
- banner:
  - heading "OpenElin" [level=1]
- main "Device details":
  - complementary:
    - text: XSHIFTER ELIN
    - button "Rename hub"
    - button "Disconnect"
    - text: 02:11:22:33:44:55
    - status: Battery --
    - navigation "Device navigation":
      - link "Setup":
        - /url: /device/02-11-22-33-44-55/setup
      - link "Device list":
        - /url: /device/02-11-22-33-44-55/list
      - link "Motor params":
        - /url: /device/02-11-22-33-44-55/motor
      - link "Buttons":
        - /url: /device/02-11-22-33-44-55/buttons
      - link "Cogs":
        - /url: /device/02-11-22-33-44-55/cogs
      - link "Log":
        - /url: /device/02-11-22-33-44-55/log
    - group "Hub controls":
      - img "Hub"
      - button "Factory reset hub": Reset
    - group "Pod controls":
      - switch "Power" [checked]
      - text: Power
      - img "Pod controls"
      - button "Toggle tune"
      - button "Shift up"
      - button "Shift down"
      - button "Pair / Shift down (hold 6s to pair)"
  - heading "Device list" [level=2]
  - button "Refresh"
  - paragraph: Scan the hub for linked devices.
  - status: No device list loaded yet.
```

# Test source

```ts
  1   | import { expect, test } from "../fixture";
  2   | import { DeviceListPageModel } from "../pages/DeviceListPageModel";
  3   | import { DevicePageModel } from "../pages/DevicePageModel";
  4   | import { LandingPageModel } from "../pages/LandingPageModel";
  5   | 
  6   | const POD_MAC = "D5:89:B2:13:FA:04";
  7   | 
  8   | test.describe("Pod connection in demo mode", () => {
  9   |   test("Full setup: add pod, write button map, pod buttons shift gears", async ({
  10  |     page,
  11  |     updateDemoDataState,
  12  |   }) => {
  13  |     const landing = new LandingPageModel(page);
  14  |     const device = new DevicePageModel(page);
  15  |     const deviceList = new DeviceListPageModel(page);
  16  | 
  17  |     // ---- Setup: clear device list so hub starts empty ----
  18  |     await landing.open();
  19  |     await landing.startDemo();
  20  |     await expect(page).toHaveURL(device.deviceRouteMatcher());
  21  | 
  22  |     await updateDemoDataState((draft) => {
  23  |       draft.list.entries = [];
  24  |     });
  25  | 
  26  |     // ---- Navigate to device list ----
  27  |     await device.goToListTab();
  28  |     await expect(page).toHaveURL(device.listRouteMatcher());
  29  | 
  30  |     // Assert list starts empty
  31  |     await expect(deviceList.root()).toBeVisible();
  32  |     await deviceList.clickRefresh();
  33  |     await expect(page.getByTestId("device-list-empty")).toBeVisible();
  34  | 
  35  |     // ---- Click Add Pod ----
> 36  |     await expect(deviceList.addPodButton()).toBeVisible();
      |                                             ^ Error: expect(locator).toBeVisible() failed
  37  |     await deviceList.addPodButton().click();
  38  | 
  39  |     // Fill in pod MAC
  40  |     await expect(deviceList.addPodDialog()).toBeVisible();
  41  |     await deviceList.addPodMacInputControl().fill(POD_MAC);
  42  |     await deviceList.addPodConfirmButton().click();
  43  | 
  44  |     // Pod should now appear in the list
  45  |     await expect.poll(async () => deviceList.rows().count()).toBe(1);
  46  |     await expect(deviceList.firstRowMac()).toHaveText(POD_MAC);
  47  | 
  48  |     // ---- Navigate to buttons page and write default button map ----
  49  |     await device.goToButtonsTab();
  50  |     await expect(page).toHaveURL(device.buttonsRouteMatcher());
  51  | 
  52  |     const writeDefaultButton = page.getByTestId("device-buttons-write-default");
  53  |     await expect(writeDefaultButton).toBeVisible();
  54  |     await writeDefaultButton.click();
  55  | 
  56  |     // Wait for button map to load (entries should appear)
  57  |     await expect.poll(
  58  |       async () => page.locator("[role='listitem']").count(),
  59  |       { timeout: 5000 },
  60  |     ).toBeGreaterThan(0);
  61  | 
  62  |     // ---- Press shift-up pod button and assert gear increases ----
  63  |     const gearBefore = await page.evaluate(() => {
  64  |       const scope = globalThis as typeof globalThis & {
  65  |         __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
  66  |       };
  67  |       return scope.__demo?.hub?.state.get().current.gear ?? 0;
  68  |     });
  69  | 
  70  |     await device.sidebarShiftUpButton().click();
  71  | 
  72  |     await expect.poll(
  73  |       async () => {
  74  |         return page.evaluate(() => {
  75  |           const scope = globalThis as typeof globalThis & {
  76  |             __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
  77  |           };
  78  |           return scope.__demo?.hub?.state.get().current.gear ?? 0;
  79  |         });
  80  |       },
  81  |       { timeout: 3000 },
  82  |     ).toBeGreaterThan(gearBefore);
  83  | 
  84  |     // ---- Press shift-down pod button and assert gear decreases ----
  85  |     const gearMid = await page.evaluate(() => {
  86  |       const scope = globalThis as typeof globalThis & {
  87  |         __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
  88  |       };
  89  |       return scope.__demo?.hub?.state.get().current.gear ?? 0;
  90  |     });
  91  | 
  92  |     await device.sidebarShiftDownButton().click();
  93  | 
  94  |     await expect.poll(
  95  |       async () => {
  96  |         return page.evaluate(() => {
  97  |           const scope = globalThis as typeof globalThis & {
  98  |             __demo?: { hub?: { state: { get: () => { current: { gear: number } } } } };
  99  |           };
  100 |           return scope.__demo?.hub?.state.get().current.gear ?? 0;
  101 |         });
  102 |       },
  103 |       { timeout: 3000 },
  104 |     ).toBeLessThan(gearMid);
  105 |   });
  106 | });
  107 | 
```