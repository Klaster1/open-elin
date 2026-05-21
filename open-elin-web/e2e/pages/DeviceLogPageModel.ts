import type { Locator, Page } from "@playwright/test";

export class DeviceLogPageModel {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("log");
  }

  output(): Locator {
    return this.page.getByTestId("log-output");
  }

  async text() {
    return (await this.output().innerText()).trim();
  }

  async lineCount() {
    const text = await this.text();
    if (!text) return 0;
    return text.split("\n").length;
  }

  async scrollToTop() {
    await this.output().evaluate((el) => {
      el.scrollTop = 0;
    });
  }

  async scrollToBottom() {
    await this.output().evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }

  async scrollTop() {
    return this.output().evaluate((el) => el.scrollTop);
  }

  async isAtBottom() {
    return this.output().evaluate((el) => {
      const threshold = 12;
      return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    });
  }
}
