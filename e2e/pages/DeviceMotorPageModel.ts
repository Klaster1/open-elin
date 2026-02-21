import type { Locator, Page } from "@playwright/test";

export class DeviceMotorPageModel {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("motor");
  }

  refreshButton(): Locator {
    return this.page.getByTestId("motor-refresh");
  }

  refreshButtonControl(): Locator {
    return this.refreshButton().locator("sl-button");
  }

  paramRows(): Locator {
    return this.page.locator('[data-test-id="motor-param-row"]');
  }

  async clickRefresh() {
    await this.refreshButtonControl().click();
  }

  paramValueByLabel(label: string): Locator {
    return this.page
      .locator('[data-test-id="motor-param-row"]')
      .filter({
        has: this.page
          .getByTestId("motor-param-label")
          .filter({ hasText: label }),
      })
      .getByTestId("motor-param-value");
  }
}
