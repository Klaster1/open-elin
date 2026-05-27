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

  emptyState(): Locator {
    return this.page.getByTestId("device-list-empty");
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

  // -- Hub card locators --

  hubCard(): Locator {
    return this.page.getByTestId("device-list-hub-card");
  }

  hubCardName(): Locator {
    return this.hubCard().getByTestId("device-list-name");
  }

  hubCardMac(): Locator {
    return this.hubCard().getByTestId("device-list-mac");
  }

  hubCardBattery(): Locator {
    return this.hubCard().getByTestId("device-list-battery");
  }

  hubCardPill(): Locator {
    return this.hubCard().getByTestId("device-list-status");
  }

  // -- Hub card action button locators --

  hubBlinkButton(): Locator {
    return this.page.getByTestId("hub-blink-button");
  }

  hubCalibrateButton(): Locator {
    return this.page.getByTestId("hub-calibrate-button");
  }

  hubHomeButton(): Locator {
    return this.page.getByTestId("hub-home-button");
  }

  hubRenameButton(): Locator {
    return this.page.getByTestId("hub-rename-button");
  }

  hubSleepButton(): Locator {
    return this.page.getByTestId("hub-sleep-button");
  }

  // -- Rename dialog locators --

  renameDialog(): Locator {
    return this.page.getByTestId("device-rename-dialog");
  }

  renameInput(): Locator {
    return this.page.getByTestId("device-rename-input");
  }

  renameInputControl(): Locator {
    return this.renameInput().locator("input");
  }

  renameConfirmButton(): Locator {
    return this.page.getByTestId("device-rename-confirm");
  }

  async openRenameDialog() {
    await this.hubRenameButton().click();
  }
}
