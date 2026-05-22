import type { Locator, Page } from "@playwright/test";

export class DeviceListPageModel {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("device-list");
  }

  refreshButton(): Locator {
    return this.page.getByTestId("device-list-refresh");
  }

  refreshButtonControl(): Locator {
    return this.refreshButton().locator("sl-button");
  }

  rows(): Locator {
    return this.page.locator('[data-test-id="device-list-row"]');
  }

  firstRow(): Locator {
    return this.rows().first();
  }

  firstRowName(): Locator {
    return this.firstRow().getByTestId("device-list-name");
  }

  firstRowMac(): Locator {
    return this.firstRow().getByTestId("device-list-mac");
  }

  firstRowDeviceId(): Locator {
    return this.firstRow().getByTestId("device-list-device-id");
  }

  firstRowBattery(): Locator {
    return this.firstRow().getByTestId("device-list-battery");
  }

  firstRowRssi(): Locator {
    return this.firstRow().getByTestId("device-list-rssi");
  }

  firstRowStatus(): Locator {
    return this.firstRow().getByTestId("device-list-status");
  }

  async firstRowBatteryText() {
    return (await this.firstRowBattery().innerText()).trim();
  }

  async clickRefresh() {
    await this.refreshButtonControl().click();
  }

  addPodButton(): Locator {
    return this.page.getByTestId("device-list-add-pod");
  }

  addPodDialog(): Locator {
    return this.page.getByTestId("add-pod-dialog");
  }

  addPodMacInput(): Locator {
    return this.page.getByTestId("add-pod-mac-input");
  }

  addPodMacInputControl(): Locator {
    return this.addPodMacInput().locator("input");
  }

  addPodConfirmButton(): Locator {
    return this.page.getByTestId("add-pod-confirm");
  }
}
