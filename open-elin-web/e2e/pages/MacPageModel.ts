import type { Locator, Page } from "@playwright/test";

export class MacPageModel {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("mac-page");
  }

  adStatus(): Locator {
    return this.page.getByTestId("mac-ad-status");
  }

  shiftStatus(): Locator {
    return this.page.getByTestId("mac-shift-status");
  }

  manualInput(): Locator {
    return this.page.getByTestId("mac-manual-input");
  }

  manualInputControl(): Locator {
    return this.manualInput().locator("input");
  }

  manualApplyButton(): Locator {
    return this.page.getByTestId("mac-manual-apply");
  }

  podControls(): Locator {
    return this.page.getByTestId("mac-pod-controls");
  }

  podShiftUpButton(): Locator {
    return this.page.getByTestId("pod-button-up");
  }
}
