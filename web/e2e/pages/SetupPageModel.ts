import type { Locator, Page } from "@playwright/test";

export class SetupPageModel {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("setup");
  }

  heading(): Locator {
    return this.page.getByRole("heading", { name: "Setup" });
  }

  currentCogCountSummary(): Locator {
    return this.page.getByTestId("setup-current-cog-count");
  }

  startButton(): Locator {
    return this.page.getByTestId("setup-start");
  }

  setupModePending(): Locator {
    return this.page.getByTestId("setup-mode-pending");
  }

  controls(): Locator {
    return this.page.getByTestId("setup-controls");
  }

  steps(): Locator {
    return this.page.getByTestId("setup-steps");
  }

  stepPanel(step: 1 | 2 | 3 | 4): Locator {
    return this.page.getByTestId(`setup-step-${step}-panel`);
  }

  cogCountSelect(): Locator {
    return this.page.getByTestId("setup-cog-count");
  }

  cassetteTeethList(): Locator {
    return this.page.getByTestId("setup-cassette-teeth-list");
  }

  cassetteToothInputs(): Locator {
    return this.page.getByTestId("setup-cassette-tooth-input");
  }

  cassetteToothInputByCog(cogIndex: number): Locator {
    return this.page.locator(
      `[data-test-id="setup-cassette-tooth-input"][data-cog-index="${cogIndex}"]`,
    );
  }

  step1NextButton(): Locator {
    return this.page.getByTestId("setup-step1-next");
  }

  smallestOffsetValue(): Locator {
    return this.page.getByTestId("setup-smallest-offset-value");
  }

  smallestTuneDecreaseButton(step: "10" | "5" | "1" | "0-1"): Locator {
    return this.page.getByTestId(`setup-smallest-tune-decrease-${step}`);
  }

  smallestTuneIncreaseButton(step: "0-1" | "1" | "5" | "10"): Locator {
    return this.page.getByTestId(`setup-smallest-tune-increase-${step}`);
  }

  step2BackButton(): Locator {
    return this.page.getByTestId("setup-step2-back");
  }

  step2NextButton(): Locator {
    return this.page.getByTestId("setup-step2-next");
  }

  largestOffsetValue(): Locator {
    return this.page.getByTestId("setup-largest-offset-value");
  }

  largestTuneDecreaseButton(step: "10" | "5" | "1" | "0-1"): Locator {
    return this.page.getByTestId(`setup-largest-tune-decrease-${step}`);
  }

  largestTuneIncreaseButton(step: "0-1" | "1" | "5" | "10"): Locator {
    return this.page.getByTestId(`setup-largest-tune-increase-${step}`);
  }

  step3BackButton(): Locator {
    return this.page.getByTestId("setup-step3-back");
  }

  writeButton(): Locator {
    return this.page.getByTestId("setup-write");
  }

  offsetError(): Locator {
    return this.page.getByTestId("setup-offset-error");
  }

  previewTable(): Locator {
    return this.page.getByTestId("setup-preview-table");
  }

  previewMetaTable(): Locator {
    return this.page.getByTestId("setup-preview-meta-table");
  }

  previewGearValues(): Locator {
    return this.page.getByTestId("setup-preview-gear");
  }

  previewOffsetValues(): Locator {
    return this.page.getByTestId("setup-preview-offset");
  }

  finishGoCogsLink(): Locator {
    return this.page.getByTestId("setup-finish-go-cogs");
  }

  finishSaveProfileButton(): Locator {
    return this.page.getByTestId("setup-finish-save-profile");
  }

  profileDialog(): Locator {
    return this.page.getByTestId("setup-profile-dialog");
  }

  profileDialogInput(): Locator {
    return this.page.getByTestId("setup-profile-dialog-input");
  }

  profileDialogConfirmButton(): Locator {
    return this.page.getByTestId("setup-profile-dialog-confirm");
  }

  profileDialogCancelButton(): Locator {
    return this.page.getByTestId("setup-profile-dialog-cancel");
  }

  async startSetup() {
    await this.startButton().click();
  }

  async continueFromStep1() {
    await this.step1NextButton().click();
  }

  async continueFromStep2() {
    await this.step2NextButton().click();
  }

  async writeToNxs() {
    await this.writeButton().click();
  }

  async openSaveProfileDialog() {
    await this.finishSaveProfileButton().click();
  }
}
