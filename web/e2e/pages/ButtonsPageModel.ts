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

  podGroups(): Locator {
    return this.page.getByTestId("pod-group");
  }

  podIndicator(): Locator {
    return this.page.getByTestId("pod-indicator");
  }

  podIndicatorImage(): Locator {
    return this.page.getByTestId("pod-indicator").locator("img");
  }

  wiredButtonGroups(): Locator {
    return this.page.getByTestId("wired-button-group");
  }

  wiredBindings(): Locator {
    return this.page.getByTestId("wired-binding");
  }

  orphanSection(): Locator {
    return this.page.getByTestId("orphan-section");
  }

  orphanButtonGroups(): Locator {
    return this.page.getByTestId("orphan-button-group");
  }

  orphanBindings(): Locator {
    return this.page.getByTestId("orphan-binding");
  }

  async openOrphanSection() {
    const details = this.orphanSection();
    if (await details.count() > 0) {
      const isOpen = await details.getAttribute("open");
      if (isOpen === null) {
        await details.locator("summary").click();
      }
    }
  }

  removeBindingButtons(): Locator {
    return this.page.getByTestId("remove-binding");
  }

  addTriggerButtons(): Locator {
    return this.page.getByTestId("add-trigger");
  }

  async clickRefresh() {
    await this.refreshButtonControl().click();
  }
}
