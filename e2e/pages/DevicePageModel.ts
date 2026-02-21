import type { Locator, Page } from "@playwright/test";

export class DevicePageModel {
  constructor(private readonly page: Page) {}

  deviceRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/(log|cogs)$/;
  }

  cogsRouteMatcher() {
    return /\/device\/[A-F0-9-]+\/cogs$/;
  }

  cogsTabLink(): Locator {
    return this.page.getByTestId("device-nav-cogs");
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
}
