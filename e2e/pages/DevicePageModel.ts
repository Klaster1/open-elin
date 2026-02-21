import type { Locator, Page } from "@playwright/test";

export class DevicePageModel {
  constructor(private readonly page: Page) {}

  deviceRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/(log|cogs|list|motor)$/;
  }

  cogsRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/cogs$/;
  }

  listRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/list$/;
  }

  motorRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/motor$/;
  }

  logRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/log$/;
  }

  cogsTabLink(): Locator {
    return this.page.getByTestId("device-nav-cogs");
  }

  listTabLink(): Locator {
    return this.page.getByTestId("device-nav-list");
  }

  motorTabLink(): Locator {
    return this.page.getByTestId("device-nav-motor");
  }

  logTabLink(): Locator {
    return this.page.getByTestId("device-nav-log");
  }

  sidebarName(): Locator {
    return this.page.getByTestId("device-sidebar-name");
  }

  sidebarMac(): Locator {
    return this.page.getByTestId("device-sidebar-mac");
  }

  sidebarBatteryStatus(): Locator {
    return this.page.getByTestId("device-sidebar-battery-status");
  }

  renameButton(): Locator {
    return this.page.getByTestId("device-rename-button");
  }

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

  disconnectButton(): Locator {
    return this.page.getByTestId("device-disconnect-button");
  }

  sidebarShiftUpButton(): Locator {
    return this.page.locator("pod-mock-gui").getByRole("button", {
      name: "Shift up",
    });
  }

  sidebarShiftDownButton(): Locator {
    return this.page.locator("pod-mock-gui").getByRole("button", {
      name: "Shift down",
    });
  }

  async goToCogsTab() {
    await this.cogsTabLink().click();
  }

  async goToListTab() {
    await this.listTabLink().click();
  }

  async goToMotorTab() {
    await this.motorTabLink().click();
  }

  async goToLogTab() {
    await this.logTabLink().click();
  }

  async openRenameDialog() {
    await this.renameButton().click();
  }

  async disconnect() {
    await this.disconnectButton().click();
  }
}
