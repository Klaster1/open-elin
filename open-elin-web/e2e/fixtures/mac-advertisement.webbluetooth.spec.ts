import { expect, test } from "../fixture";
import { DevicePageModel } from "../pages/DevicePageModel";
import { LandingPageModel } from "../pages/LandingPageModel";

test.describe("MAC acquisition via BLE advertisements", () => {
  test("uses watchAdvertisements manufacturer data to discover MAC", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const msgUuid = "a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79";
      const manufacturerCompanyId = 0xde98;

      const msgCharacteristic = {
        writeValueWithoutResponse: async () => {},
        writeValue: async () => {},
        addEventListener: () => {},
        startNotifications: async () => {},
      };

      const gattService = {
        getCharacteristic: async (uuid: string) => {
          if (uuid.toLowerCase() === msgUuid) {
            return msgCharacteristic;
          }
          throw new Error("Characteristic not found");
        },
      };

      const gattServer = {
        getPrimaryService: async () => gattService,
      };

      const advertisementTarget = new EventTarget();

      const fakeDevice = {
        id: "fake-ble-device",
        name: "Fake Hub",
        gatt: {
          connect: async () => gattServer,
          disconnect: () => {},
        },
        addEventListener:
          advertisementTarget.addEventListener.bind(advertisementTarget),
        removeEventListener:
          advertisementTarget.removeEventListener.bind(advertisementTarget),
        watchAdvertisements: async () => {
          const manufacturerBytes = new Uint8Array([
            0x55, 0x44, 0x33, 0x22, 0x11, 0x02,
          ]);
          const manufacturerData = new Map<number, DataView>([
            [
              manufacturerCompanyId,
              new DataView(manufacturerBytes.buffer.slice(0)),
            ],
          ]);

          setTimeout(() => {
            const event = Object.assign(new Event("advertisementreceived"), {
              manufacturerData,
            });
            advertisementTarget.dispatchEvent(event);
          }, 10);
        },
      };

      const fakeBluetooth = {
        requestDevice: async () => fakeDevice,
      };

      const nativeBluetooth = (navigator as any).bluetooth;
      if (nativeBluetooth && typeof nativeBluetooth === "object") {
        nativeBluetooth.requestDevice = fakeBluetooth.requestDevice;
      } else {
        Object.defineProperty(navigator, "bluetooth", {
          configurable: true,
          value: fakeBluetooth,
        });
      }
    });

    const landing = new LandingPageModel(page);
    const device = new DevicePageModel(page);

    // Go to app
    await landing.open();
    await expect(landing.root()).toBeVisible();

    // Start normal BLE connect flow with monkey-patched browser bluetooth
    await landing.startConnect();

    // Assert app treated advertisement MAC as discovered and navigated to device route
    await expect(page).toHaveURL(device.deviceRouteMatcher());
    await expect(device.sidebarMac()).toHaveText("02:11:22:33:44:55");
  });
});
