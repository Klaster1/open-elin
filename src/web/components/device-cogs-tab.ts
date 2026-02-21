import { LitElement, css, html } from "lit";
import { SignalWatcher, signal } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./empty-state.ts";

export class DeviceCogsTab extends SignalWatcher(LitElement) {
  private readonly absoluteSteps = [10, 5, 1, 0.1] as const;
  private profileStatus = signal("");
  private profileDialogOpen = signal(false);
  private profileDialogValue = signal("");
  private profileDialogError = signal("");

  static styles = [
    sharedStyles,
    css`
      .card {
        background: var(--panel, #141c24);
        border-radius: 16px;
        padding: 18px 20px;
        border: 1px solid var(--panel-border, #223142);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }

      .card-head {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
      }

      .card-head h2,
      .profiles-head h2 {
        margin: 0;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .cog-controls {
        margin-top: 16px;
        display: grid;
        grid-template-columns: minmax(84px, 96px) minmax(0, 1fr) minmax(
            84px,
            96px
          );
        gap: 10px;
        align-items: stretch;
      }

      .shift-side {
        display: flex;
        justify-content: center;
        height: 100%;
      }

      .shift-side-button {
        width: 100%;
        height: 100%;
        min-height: 0;
      }

      .shift-side-button::part(base) {
        height: 100%;
      }

      .shift-side-button::part(label) {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .shift-side-content {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        line-height: 1;
      }

      .shift-side-content sl-icon {
        display: block;
        width: 1em;
        height: 1em;
        font-size: 26px;
      }

      .shift-side-label {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      @media (max-width: 860px) {
        .cog-controls {
          grid-template-columns: 1fr;
        }

        .shift-side-button {
          height: auto;
          min-height: 76px;
        }

        .shift-side-content {
          flex-direction: row;
          gap: 10px;
        }

        .shift-side-content sl-icon {
          font-size: 22px;
        }
      }

      .absolute-controls {
        margin-top: 12px;
        display: flex;
        flex-wrap: nowrap;
        gap: 10px;
        align-items: center;
        justify-content: center;
      }

      .absolute-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .absolute-center {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted, #98a6b5);
        padding: 0 4px;
      }

      .absolute-step {
        min-width: 64px;
      }

      .absolute-step::part(label) {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .absolute-step-content {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        line-height: 1;
      }

      .absolute-step-content sl-icon {
        display: block;
        width: 1em;
        height: 1em;
        font-size: 14px;
      }

      .gear-strip {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 6px;
        align-items: flex-end;
        justify-content: stretch;
        width: 100%;
        overflow: hidden;
        padding: 8px 2px 4px;
      }

      .gear-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .gear-number {
        font-size: 11px;
        font-weight: 600;
        color: var(--muted, #98a6b5);
        min-height: 16px;
        display: flex;
        align-items: flex-end;
      }

      .gear-teeth {
        font-size: 10px;
        font-weight: 600;
        color: #7ef0c3;
        min-height: 14px;
        display: flex;
        align-items: flex-end;
      }

      .gear-teeth.missing {
        color: var(--muted, #98a6b5);
      }

      .gear-line {
        width: 6px;
        height: var(--gear-height, 18px);
        border-radius: 999px;
        background: #3a4a5c;
      }

      .gear-offset {
        font-size: 11px;
        font-weight: 600;
        min-height: 16px;
        display: flex;
        align-items: flex-end;
      }

      .gear-offset.precise {
        color: #7ef0c3;
      }

      .gear-offset.approx {
        color: var(--warn, #ffb454);
      }

      .gear-offset.missing {
        color: var(--muted, #98a6b5);
      }

      .gear-current {
        height: 18px;
        color: #7ef0c3;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }

      .gear-current svg {
        width: 10px;
        height: 18px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .empty-state {
        margin-top: 16px;
        padding: 18px;
        border-radius: 12px;
        border: 1px dashed #3a4a5c;
        background: rgba(20, 30, 40, 0.6);
        min-height: 140px;
        display: flex;
        align-items: center;
        color: var(--muted, #98a6b5);
      }

      .log {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid #233143;
        background: #0f1620;
        font-family: Consolas, monospace;
      }

      .profiles {
        margin-top: 18px;
      }

      .profiles-divider {
        margin: 0 0 16px;
        --color: var(--panel-border, #223142);
      }

      .profiles-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .profiles-list {
        margin-top: 12px;
        display: grid;
        gap: 8px;
      }

      .profile-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        border: 1px solid #233143;
        border-radius: 10px;
        padding: 10px;
        background: #0f1620;
      }

      .profile-name {
        font-weight: 700;
        font-size: 13px;
      }

      .profile-meta {
        margin-top: 4px;
        color: var(--muted, #98a6b5);
        font-size: 12px;
      }

      .profile-meta-table {
        width: 100%;
        border-collapse: collapse;
      }

      .profile-meta-table td {
        border-top: 1px solid #233143;
        padding: 4px 6px;
        text-align: center;
        white-space: nowrap;
      }

      .profile-meta-table tr:first-child td {
        border-top: 0;
      }

      .profile-meta-table td:first-child {
        text-align: left;
        font-weight: 600;
        color: var(--muted, #98a6b5);
      }

      .profile-actions {
        display: flex;
        gap: 8px;
        align-items: start;
      }

      .profiles-empty {
        margin-top: 10px;
        padding: 12px;
        border-radius: 10px;
        border: 1px dashed #3a4a5c;
        display: grid;
        gap: 10px;
      }

      .profile-status {
        margin-top: 10px;
        font-size: 12px;
        color: var(--warn, #ffb454);
      }

      .profile-status.busy {
        color: #7ef0c3;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        width: 100%;
      }

      .dialog-cancel::part(base) {
        border-color: #2b3b4c;
        background: #0e141b;
        color: inherit;
      }

      sl-dialog::part(header) {
        border-bottom: 1px solid #243241;
      }

      sl-dialog::part(body) {
        padding-top: 12px;
      }

      sl-dialog::part(footer) {
        border-top: 1px solid #243241;
      }

      sl-dialog::part(close-button) {
        color: #98a6b5;
      }

      sl-input::part(base) {
        border-radius: 10px;
        border-color: #2b3b4c;
        background: #0e141b;
        color: inherit;
      }

      sl-input::part(form-control) {
        gap: 6px;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    appActions.reloadCogProfiles();
    const mac = appState.mac.get();
    if (appState.connected.get() && mac) {
      void appActions.ensureGearsForMac(mac);
    }
  }

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const writeLocked = appState.cogsProfileWriteInProgress.get();
    const controlsDisabled = !canSend || writeLocked;
    const mac = appState.mac.get();
    const gearMap = appState.gears.get();
    const gearList = mac ? gearMap[mac] : undefined;
    const profiles = appState.cogProfiles.get();
    return html`
      <div class="card" data-test-id="cogs-tab">
        <div class="card-head">
          <h2>Cogs</h2>
          <p class="hint">Rear cog diagnostics and live position snapshots.</p>
        </div>
        <div class="actions">
          <sl-button
            data-test-id="cogs-get-rear-cog-info"
            ?disabled=${controlsDisabled}
            @click=${this.onGetRearCogInfo}
            >Get rear cog info</sl-button
          >
          <sl-button
            data-test-id="cogs-get-position"
            ?disabled=${controlsDisabled}
            @click=${this.onGetPosition}
            >Get position</sl-button
          >
        </div>
        <div class="absolute-controls" data-test-id="cogs-absolute-controls">
          ${this.renderAbsoluteControls(controlsDisabled, gearList)}
        </div>
        ${this.renderCogControls(controlsDisabled, gearList)}
        ${this.renderProfilesSection(controlsDisabled, gearList, profiles)}
        ${writeLocked
          ? html`
              <div
                class="profile-status busy"
                data-test-id="cogs-profile-applying"
                role="status"
              >
                Applying profile...
              </div>
            `
          : ""}
        ${this.profileStatus.get() && !writeLocked
          ? html`<div class="profile-status" data-test-id="cogs-profile-status">
              ${this.profileStatus.get()}
            </div>`
          : ""}
      </div>
      <sl-dialog
        data-test-id="cogs-profile-dialog"
        label="Save profile"
        ?open=${this.profileDialogOpen.get()}
        @sl-request-close=${this.onProfileDialogRequestClose}
      >
        <sl-input
          data-test-id="cogs-profile-dialog-input"
          label="Profile name"
          placeholder="Enter profile name"
          .value=${this.profileDialogValue.get()}
          ?invalid=${Boolean(this.profileDialogError.get())}
          help-text=${this.profileDialogError.get()}
          @sl-input=${this.onProfileDialogInput}
          ?disabled=${writeLocked}
        ></sl-input>
        <div slot="footer" class="dialog-actions">
          <sl-button
            data-test-id="cogs-profile-dialog-cancel"
            class="dialog-cancel"
            ?disabled=${writeLocked}
            @click=${this.closeProfileDialog}
          >
            Cancel
          </sl-button>
          <sl-button
            data-test-id="cogs-profile-dialog-confirm"
            variant="primary"
            ?disabled=${writeLocked}
            @click=${this.confirmSaveProfile}
          >
            Save
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }

  private renderCogControls(
    controlsDisabled: boolean,
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    return html`
      <div class="cog-controls">
        <div class="shift-side shift-side-left">
          <sl-button
            class="shift-side-button"
            data-test-id="cogs-shift-down"
            size="large"
            ?disabled=${controlsDisabled}
            @click=${this.onShiftDown}
          >
            <span class="shift-side-content"
              ><sl-icon
                library="system"
                name="chevron-left"
                aria-hidden="true"
              ></sl-icon
              ><span class="shift-side-label">Shift down</span></span
            >
          </sl-button>
        </div>

        ${gearList?.length
          ? this.renderGearStrip(gearList)
          : html`
              <div class="empty-state" role="status" aria-live="polite">
                No gear data yet. Fetch rear cog info to get started.
              </div>
            `}

        <div class="shift-side shift-side-right">
          <sl-button
            class="shift-side-button"
            data-test-id="cogs-shift-up"
            size="large"
            ?disabled=${controlsDisabled}
            @click=${this.onShiftUp}
          >
            <span class="shift-side-content"
              ><sl-icon
                library="system"
                name="chevron-right"
                aria-hidden="true"
              ></sl-icon
              ><span class="shift-side-label">Shift up</span></span
            >
          </sl-button>
        </div>
      </div>
    `;
  }

  private renderAbsoluteControls(
    controlsDisabled: boolean,
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    const currentOffset = this.getCurrentAbsoluteOffset(gearList);
    const disabled = controlsDisabled || currentOffset === null;
    return html`
      <div class="absolute-group" role="group" aria-label="Decrease absolute">
        ${this.absoluteSteps.map(
          (step) => html`
            <sl-button
              class="absolute-step"
              data-test-id=${`cogs-tune-decrease-${this.getStepToken(step)}`}
              size="small"
              ?disabled=${disabled}
              @click=${() => this.onAbsoluteNudge(-step, currentOffset)}
            >
              <span class="absolute-step-content"
                ><sl-icon
                  library="system"
                  name="chevron-left"
                  aria-hidden="true"
                ></sl-icon
                >${step}</span
              ></sl-button
            >
          `,
        )}
      </div>
      <div class="absolute-center">tune</div>
      <div class="absolute-group" role="group" aria-label="Increase absolute">
        ${[...this.absoluteSteps].reverse().map(
          (step) => html`
            <sl-button
              class="absolute-step"
              data-test-id=${`cogs-tune-increase-${this.getStepToken(step)}`}
              size="small"
              ?disabled=${disabled}
              @click=${() => this.onAbsoluteNudge(step, currentOffset)}
            >
              <span class="absolute-step-content"
                >${step}<sl-icon
                  library="system"
                  name="chevron-right"
                  aria-hidden="true"
                ></sl-icon></span
            ></sl-button>
          `,
        )}
      </div>
    `;
  }

  private renderProfilesSection(
    controlsDisabled: boolean,
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
    profiles: Array<{
      name: string;
      cogs: Array<{
        offset: number;
        toothCount: number;
      }>;
    }>,
  ) {
    const canSave = this.canSaveProfileFromGears(gearList);
    const disableSave = controlsDisabled || !canSave;
    const disableProfileAction = controlsDisabled;
    return html`
      <section class="profiles" data-test-id="cogs-profiles-section">
        <sl-divider class="profiles-divider"></sl-divider>
        <div class="profiles-head">
          <h2>Profiles</h2>
          ${profiles.length
            ? html`
                <sl-button
                  size="small"
                  data-test-id="cogs-profile-save-current"
                  ?disabled=${disableSave}
                  @click=${this.openProfileDialog}
                >
                  Save current as profile
                </sl-button>
              `
            : ""}
        </div>
        ${profiles.length
          ? html`
              <div class="profiles-list" data-test-id="cogs-profiles-list">
                ${profiles.map((profile) =>
                  this.renderProfileRow(profile, disableProfileAction),
                )}
              </div>
            `
          : html`
              <empty-state
                data-test-id="cogs-profiles-empty"
                title="No profiles yet"
                message="Shift through all gears first to collect precise offsets, then save a profile."
              >
                <svg
                  slot="icon"
                  viewBox="0 0 64 64"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="12"
                    y="10"
                    width="40"
                    height="44"
                    rx="8"
                    stroke="#7ef0c3"
                    stroke-width="4"
                  />
                  <path
                    d="M22 22h20"
                    stroke="#7ef0c3"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                  <path
                    d="M22 32h14"
                    stroke="#7ef0c3"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                  <circle
                    cx="42"
                    cy="40"
                    r="6"
                    stroke="#ffb454"
                    stroke-width="4"
                  />
                </svg>
                <div slot="actions">
                  <sl-button
                    size="small"
                    data-test-id="cogs-profile-save-empty"
                    ?disabled=${disableSave}
                    @click=${this.openProfileDialog}
                  >
                    Save current as profile
                  </sl-button>
                </div>
              </empty-state>
            `}
      </section>
    `;
  }

  private renderProfileRow(
    profile: {
      name: string;
      cogs: Array<{
        offset: number;
        toothCount: number;
      }>;
    },
    disabled: boolean,
  ) {
    const teethValues = profile.cogs.map((cog) => `${cog.toothCount}T`);
    const offsetValues = profile.cogs.map((cog) => cog.offset.toFixed(2));
    return html`
      <div
        class="profile-row"
        data-test-id="cogs-profile-row"
        data-profile-name=${profile.name}
      >
        <div>
          <div class="profile-name" data-test-id="cogs-profile-name">
            ${profile.name}
          </div>
          <div class="profile-meta">
            <table class="profile-meta-table">
              <tr>
                <td data-test-id="cogs-profile-count">
                  Cogs: ${profile.cogs.length}
                </td>
                ${teethValues.map(
                  (value) =>
                    html`<td data-test-id="cogs-profile-teeth">${value}</td>`,
                )}
              </tr>
              <tr>
                <td>Offsets</td>
                ${offsetValues.map(
                  (value) =>
                    html`<td data-test-id="cogs-profile-offsets">${value}</td>`,
                )}
              </tr>
            </table>
          </div>
        </div>
        <div class="profile-actions">
          <sl-button
            size="small"
            data-test-id="cogs-profile-apply"
            ?disabled=${disabled}
            @click=${() => this.onApplyProfile(profile.name)}
          >
            Apply
          </sl-button>
          <sl-button
            size="small"
            variant="danger"
            data-test-id="cogs-profile-remove"
            ?disabled=${disabled}
            @click=${() => this.onRemoveProfile(profile.name)}
          >
            Remove
          </sl-button>
        </div>
      </div>
    `;
  }

  private canSaveProfileFromGears(
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    if (!gearList?.length) return false;
    if (gearList.some((gear) => gear.offsetPrecise === null)) return false;
    if (gearList.some((gear) => gear.teeth === null)) return false;
    return true;
  }

  private renderGearStrip(
    gears: Array<{
      gearNumber: number;
      offsetApproximate: number;
      offsetPrecise: number | null;
      current: boolean;
      teeth: number | null;
    }>,
  ) {
    const sorted = [...gears].sort((a, b) => a.gearNumber - b.gearNumber);
    const minGear = sorted[0]?.gearNumber ?? 1;
    const maxGear = sorted[sorted.length - 1]?.gearNumber ?? minGear;
    return html`
      <div class="gear-strip" role="list" data-test-id="cogs-gear-strip">
        ${sorted.map((gear) => this.renderGear(gear, minGear, maxGear))}
      </div>
    `;
  }

  private renderGear(
    gear: {
      gearNumber: number;
      offsetApproximate: number;
      offsetPrecise: number | null;
      current: boolean;
      teeth: number | null;
    },
    minGear: number,
    maxGear: number,
  ) {
    const range = Math.max(1, maxGear - minGear);
    const ratio = (gear.gearNumber - minGear) / range;
    const minHeight = 18;
    const maxHeight = 88;
    const height = Math.round(minHeight + ratio * (maxHeight - minHeight));
    const precise = gear.offsetPrecise;
    const offsetValue = precise ?? gear.offsetApproximate;
    const offsetLabel = Number.isFinite(offsetValue)
      ? offsetValue.toFixed(2)
      : "--";
    const offsetClass = precise !== null ? "precise" : "approx";
    const hasTeeth = Number.isFinite(gear.teeth);
    const teethLabel = hasTeeth ? `${gear.teeth}T` : "--";
    return html`
      <div
        class="gear-card"
        role="listitem"
        data-test-id="cogs-gear-card"
        data-gear-number=${gear.gearNumber}
        data-current=${gear.current ? "true" : "false"}
      >
        <div class="gear-number" data-test-id="cogs-gear-number">
          ${gear.gearNumber}
        </div>
        <div class="gear-teeth ${hasTeeth ? "" : "missing"}">${teethLabel}</div>
        <div class="gear-line" style="--gear-height: ${height}px"></div>
        <div
          class="gear-offset ${offsetClass}"
          data-test-id="cogs-gear-offset"
          data-offset-mode=${offsetClass}
        >
          ${offsetLabel}
        </div>
        <div
          class="gear-current"
          data-test-id="cogs-gear-current"
          data-current=${gear.current ? "true" : "false"}
          aria-hidden=${!gear.current}
        >
          ${gear.current
            ? html`
                <svg viewBox="0 0 10 18" aria-hidden="true">
                  <path d="M5 17V3"></path>
                  <path d="M2 6L5 3L8 6"></path>
                </svg>
              `
            : ""}
        </div>
      </div>
    `;
  }

  private async onGetRearCogInfo() {
    await appActions.getRearCogInfo();
  }

  private async onGetPosition() {
    await appActions.getPosition();
  }

  private async onShiftUp() {
    await appActions.shiftUp();
  }

  private async onShiftDown() {
    await appActions.shiftDown();
  }

  private getStepToken(step: number) {
    return step.toString().replace(".", "-");
  }

  private getCurrentAbsoluteOffset(
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    const currentGear = gearList?.find((gear) => gear.current);
    if (currentGear) {
      const gearOffset =
        currentGear.offsetPrecise ?? currentGear.offsetApproximate;
      if (Number.isFinite(gearOffset)) return gearOffset;
    }

    const absolutePosition = appState.position.get()?.absolutePosition;
    if (
      typeof absolutePosition === "number" &&
      Number.isFinite(absolutePosition)
    ) {
      return absolutePosition;
    }

    return null;
  }

  private async onAbsoluteNudge(delta: number, baseOffset: number | null) {
    if (baseOffset === null) return;
    if (appState.cogsProfileWriteInProgress.get()) return;
    const target = Math.round((baseOffset + delta) * 10) / 10;
    await appActions.absoluteMove(target);
  }

  private setProfileStatus(value: string) {
    this.profileStatus.set(value);
  }

  private openProfileDialog = () => {
    if (appState.cogsProfileWriteInProgress.get()) return;
    this.profileDialogValue.set("");
    this.profileDialogError.set("");
    this.profileDialogOpen.set(true);
  };

  private closeProfileDialog = () => {
    this.profileDialogOpen.set(false);
    this.profileDialogError.set("");
  };

  private onProfileDialogRequestClose(event: Event) {
    if (appState.cogsProfileWriteInProgress.get()) {
      event.preventDefault();
      return;
    }
    this.closeProfileDialog();
  }

  private onProfileDialogInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.profileDialogValue.set(target?.value ?? "");
    if (this.profileDialogError.get()) {
      this.profileDialogError.set("");
    }
  }

  private confirmSaveProfile = () => {
    if (appState.cogsProfileWriteInProgress.get()) return;
    const result = appActions.saveCurrentCogProfile(
      this.profileDialogValue.get(),
    );
    if (!result.ok) {
      this.profileDialogError.set(result.message);
      return;
    }
    this.profileDialogOpen.set(false);
    this.profileDialogError.set("");
    this.setProfileStatus("");
  };

  private async onApplyProfile(name: string) {
    if (appState.cogsProfileWriteInProgress.get()) return;
    this.setProfileStatus("");
    const result = await appActions.applyCogProfile(name);
    if (!result.ok) {
      this.setProfileStatus(result.message);
      return;
    }
  }

  private onRemoveProfile(name: string) {
    if (appState.cogsProfileWriteInProgress.get()) return;
    appActions.removeCogProfile(name);
    this.setProfileStatus("");
  }
}

if (!customElements.get("device-cogs-tab")) {
  customElements.define("device-cogs-tab", DeviceCogsTab);
}

export {};
