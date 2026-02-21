import type { Locator, Page } from "@playwright/test";

export class CogsPageModel {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("cogs-tab");
  }

  heading(): Locator {
    return this.page.getByRole("heading", { name: "Cogs" });
  }

  getRearCogInfoButton(): Locator {
    return this.page.getByTestId("cogs-get-rear-cog-info");
  }

  getPositionButton(): Locator {
    return this.page.getByTestId("cogs-get-position");
  }

  shiftUpButton(): Locator {
    return this.page.getByTestId("cogs-shift-up");
  }

  shiftDownButton(): Locator {
    return this.page.getByTestId("cogs-shift-down");
  }

  tuneDecreaseSmallButton(): Locator {
    return this.page.getByTestId("cogs-tune-decrease-0-1");
  }

  tuneDecrease10Button(): Locator {
    return this.page.getByTestId("cogs-tune-decrease-10");
  }

  tuneDecrease5Button(): Locator {
    return this.page.getByTestId("cogs-tune-decrease-5");
  }

  tuneDecrease1Button(): Locator {
    return this.page.getByTestId("cogs-tune-decrease-1");
  }

  tuneIncrease01Button(): Locator {
    return this.page.getByTestId("cogs-tune-increase-0-1");
  }

  tuneIncrease1Button(): Locator {
    return this.page.getByTestId("cogs-tune-increase-1");
  }

  tuneIncrease5Button(): Locator {
    return this.page.getByTestId("cogs-tune-increase-5");
  }

  tuneIncrease10Button(): Locator {
    return this.page.getByTestId("cogs-tune-increase-10");
  }

  gearStrip(): Locator {
    return this.page.getByTestId("cogs-gear-strip");
  }

  gearCards(): Locator {
    return this.page.locator('[data-test-id="cogs-gear-card"]');
  }

  currentGearCard(): Locator {
    return this.page.locator(
      '[data-test-id="cogs-gear-card"][data-current="true"]',
    );
  }

  nonCurrentGearCards(): Locator {
    return this.page.locator(
      '[data-test-id="cogs-gear-card"][data-current="false"]',
    );
  }

  currentGearArrow(): Locator {
    return this.currentGearCard().locator(
      '[data-test-id="cogs-gear-current"] svg',
    );
  }

  currentGearOffset(): Locator {
    return this.currentGearCard().getByTestId("cogs-gear-offset");
  }

  async currentGearOffsetMode() {
    const mode =
      await this.currentGearOffset().getAttribute("data-offset-mode");
    if (!mode) {
      throw new Error("Current gear offset mode is not available");
    }
    return mode;
  }

  async nonCurrentGearOffsetMode(index: number) {
    const mode = await this.nonCurrentGearCards()
      .nth(index)
      .getByTestId("cogs-gear-offset")
      .getAttribute("data-offset-mode");
    if (!mode) {
      throw new Error(
        `Non-current gear offset mode is not available at index ${index}`,
      );
    }
    return mode;
  }

  async gearOffsetMode(index: number) {
    const mode = await this.gearCards()
      .nth(index)
      .getByTestId("cogs-gear-offset")
      .getAttribute("data-offset-mode");
    if (!mode) {
      throw new Error(`Gear offset mode is not available at index ${index}`);
    }
    return mode;
  }

  gearNumberInCard(index: number): Locator {
    return this.gearCards().nth(index).getByTestId("cogs-gear-number");
  }

  gearTeethInCard(index: number): Locator {
    return this.gearCards().nth(index).locator(".gear-teeth");
  }

  profilesSection(): Locator {
    return this.page.getByTestId("cogs-profiles-section");
  }

  profilesEmptyState(): Locator {
    return this.page.getByTestId("cogs-profiles-empty");
  }

  profilesList(): Locator {
    return this.page.getByTestId("cogs-profiles-list");
  }

  profileRows(): Locator {
    return this.page.locator('[data-test-id="cogs-profile-row"]');
  }

  saveProfileButtonInEmptyState(): Locator {
    return this.page.getByTestId("cogs-profile-save-empty");
  }

  saveProfileButton(): Locator {
    return this.page.getByTestId("cogs-profile-save-current");
  }

  profileApplyingStatus(): Locator {
    return this.page.getByTestId("cogs-profile-applying");
  }

  profileStatus(): Locator {
    return this.page.getByTestId("cogs-profile-status");
  }

  profileRowByName(name: string): Locator {
    return this.page.locator(
      `[data-test-id="cogs-profile-row"][data-profile-name="${name}"]`,
    );
  }

  profileApplyButton(name: string): Locator {
    return this.profileRowByName(name).getByTestId("cogs-profile-apply");
  }

  profileRenameButton(name: string): Locator {
    return this.profileRowByName(name).getByTestId("cogs-profile-rename");
  }

  profileRemoveButton(name: string): Locator {
    return this.profileRowByName(name).getByTestId("cogs-profile-remove");
  }

  profileOffsets(name: string): Locator {
    return this.profileRowByName(name).getByTestId("cogs-profile-offsets");
  }

  profileTeeth(name: string): Locator {
    return this.profileRowByName(name).getByTestId("cogs-profile-teeth");
  }

  profileDialog(): Locator {
    return this.page.getByTestId("cogs-profile-dialog");
  }

  profileDialogInput(): Locator {
    return this.page.getByTestId("cogs-profile-dialog-input");
  }

  profileDialogConfirmButton(): Locator {
    return this.page.getByTestId("cogs-profile-dialog-confirm");
  }

  profileDialogCancelButton(): Locator {
    return this.page.getByTestId("cogs-profile-dialog-cancel");
  }

  profileRenameDialog(): Locator {
    return this.page.getByTestId("cogs-profile-rename-dialog");
  }

  profileRenameDialogInput(): Locator {
    return this.page.getByTestId("cogs-profile-rename-dialog-input");
  }

  profileRenameDialogConfirmButton(): Locator {
    return this.page.getByTestId("cogs-profile-rename-dialog-confirm");
  }

  profileRenameDialogCancelButton(): Locator {
    return this.page.getByTestId("cogs-profile-rename-dialog-cancel");
  }

  async fillProfileRenameDialogInput(value: string) {
    await this.profileRenameDialogInput().click();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.type(value);
  }

  async fillProfileDialogInput(value: string) {
    await this.profileDialogInput().click();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.type(value);
  }

  async getRearCogInfo() {
    await this.getRearCogInfoButton().click();
  }

  async getPosition() {
    await this.getPositionButton().click();
  }

  async currentGearNumber() {
    const gear = await this.currentGearCard().getAttribute("data-gear-number");
    if (!gear) {
      throw new Error("Current gear number is not available");
    }
    return Number(gear);
  }

  async currentGearOffsetText() {
    return (
      await this.currentGearCard().getByTestId("cogs-gear-offset").innerText()
    ).trim();
  }

  async currentGearOffsetValue() {
    const text = await this.currentGearOffsetText();
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value)) {
      throw new Error(`Current gear offset is not numeric: ${text}`);
    }
    return value;
  }

  async shiftUp() {
    await this.shiftUpButton().click();
  }

  async shiftDown() {
    await this.shiftDownButton().click();
  }

  async gearCount() {
    return this.gearCards().count();
  }
}
