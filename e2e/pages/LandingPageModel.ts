import type { Locator, Page } from "@playwright/test";

export class LandingPageModel {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/");
  }

  root(): Locator {
    return this.page.getByTestId("landing-page");
  }

  demoButton(): Locator {
    return this.page.getByTestId("landing-demo-button");
  }

  async startDemo() {
    await this.demoButton().click();
  }
}
