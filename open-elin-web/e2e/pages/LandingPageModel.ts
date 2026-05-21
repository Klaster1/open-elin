import type { Locator, Page } from "@playwright/test";

export class LandingPageModel {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/");
  }

  root(): Locator {
    return this.page.getByTestId("connection-empty-state");
  }

  demoButton(): Locator {
    return this.page.getByTestId("landing-demo-button");
  }

  connectButton(): Locator {
    return this.page.getByTestId("landing-connect-button");
  }

  macRouteMatcher() {
    return /\/mac$/;
  }

  async startDemo() {
    await this.demoButton().click();
  }

  async startConnect() {
    await this.connectButton().click();
  }

  async holdAltForDemoFull() {
    await this.page.keyboard.down("Alt");
  }

  async releaseAltForDemoFull() {
    await this.page.keyboard.up("Alt");
  }
}
