import type { Locator, Page } from "@playwright/test";

export class DevicePageModel {
  constructor(private readonly page: Page) {}

  deviceRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/(log|cogs|list)$/;
  }

  cogsRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/cogs$/;
  }

  listRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/list$/;
  }

  cogsTabLink(): Locator {
    return this.page.getByTestId("device-nav-cogs");
  }

  listTabLink(): Locator {
    return this.page.getByTestId("device-nav-list");
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
}
