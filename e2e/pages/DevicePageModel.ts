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

  cogsTabLink(): Locator {
    return this.page.getByTestId("device-nav-cogs");
  }

  listTabLink(): Locator {
    return this.page.getByTestId("device-nav-list");
  }

  motorTabLink(): Locator {
    return this.page.getByTestId("device-nav-motor");
  }

  sidebarName(): Locator {
    return this.page.getByTestId("device-sidebar-name");
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

  async openRenameDialog() {
    await this.renameButton().click();
  }
}
