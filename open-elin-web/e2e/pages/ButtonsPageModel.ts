import type { Locator, Page } from "@playwright/test";

export class ButtonsPageModel {
  constructor(private readonly page: Page) {}

  refreshButton(): Locator {
    return this.page.getByTestId("device-buttons-refresh");
  }

  refreshButtonControl(): Locator {
    return this.refreshButton().locator("sl-button");
  }

  writeDefaultButton(): Locator {
    return this.page.getByTestId("device-buttons-write-default");
  }

  list(): Locator {
    return this.page.getByTestId("device-buttons-list");
  }

  emptyState(): Locator {
    return this.page.getByTestId("device-buttons-empty");
  }

  mappingCards(): Locator {
    return this.page.locator('[data-test-id="device-buttons-mapping"]');
  }

  async clickRefresh() {
    await this.refreshButtonControl().click();
  }
}
