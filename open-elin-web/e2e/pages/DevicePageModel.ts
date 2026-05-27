import type { Locator, Page } from "@playwright/test";

export class DevicePageModel {
  constructor(private readonly page: Page) {}

  deviceRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/(setup|cogs|list|motor|buttons)$/;
  }

  setupRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/setup$/;
  }

  setupTabLink(): Locator {
    return this.page.getByTestId("device-nav-setup");
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

  cogsTabLink(): Locator {
    return this.page.getByTestId("device-nav-cogs");
  }

  listTabLink(): Locator {
    return this.page.getByTestId("device-nav-list");
  }

  motorTabLink(): Locator {
    return this.page.getByTestId("device-nav-motor");
  }

  buttonsRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/buttons$/;
  }

  buttonsTabLink(): Locator {
    return this.page.getByTestId("device-nav-buttons");
  }

  async goToButtonsTab() {
    await this.buttonsTabLink().click();
  }

  consoleToggle(): Locator {
    return this.page.getByTestId("console-toggle");
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

  disconnectButton(): Locator {
    return this.page.getByTestId("device-disconnect-button");
  }

  hubResetButton(): Locator {
    return this.page.getByTestId("hub-reset-button");
  }

  async resetHubViaMockGui() {
    await this.hubResetButton().click();
  }

  sidebarShiftUpButton(): Locator {
    return this.page
      .locator("pod-mock-gui")
      .getByTestId("pod-button-group-A")
      .getByTestId("pod-trigger-press");
  }

  sidebarShiftDownButton(): Locator {
    return this.page
      .locator("pod-mock-gui")
      .getByTestId("pod-button-group-A-1")
      .getByTestId("pod-trigger-press");
  }

  async goToCogsTab() {
    await this.cogsTabLink().click();
  }

  async goToSetupTab() {
    await this.setupTabLink().click();
  }

  async goToListTab() {
    await this.listTabLink().click();
  }

  async goToMotorTab() {
    await this.motorTabLink().click();
  }

  async toggleConsole() {
    await this.consoleToggle().click();
  }

  async disconnect() {
    await this.disconnectButton().click();
  }
}
