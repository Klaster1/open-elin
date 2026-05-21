import { LitElement, css, html } from "lit";
import { SignalWatcher, signal } from "@lit-labs/signals";

import {
  appActions,
  appState,
  clampOffsetToBounds,
  getOffsetBounds,
} from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./cog-profile-meta-table.ts";
import "./tune-controls.ts";

export class PageDeviceSetup extends SignalWatcher(LitElement) {
  private setupMode = signal(false);
  private currentStep = signal<1 | 2 | 3 | 4>(1);
  private selectedCogCount = signal(12);
  private cassetteTeeth = signal<number[]>(Array.from({ length: 12 }, () => 0));
  private smallestOffset = signal<number | null>(null);
  private largestOffset = signal<number | null>(null);
  private offsetValidationError = signal("");
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

      .card-head h2 {
        margin: 0;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .summary {
        margin: 0 0 14px;
        color: var(--text, #e7edf5);
      }

      .summary strong {
        color: var(--text, #e7edf5);
      }

      .copy {
        margin: 0;
        color: var(--muted, #98a6b5);
        line-height: 1.5;
      }

      .copy + .copy {
        margin-top: 10px;
      }

      .help {
        margin-top: 14px;
      }

      .help sl-details + sl-details {
        margin-top: 8px;
      }

      .help sl-details::part(base) {
        border-radius: 12px;
        border: 1px solid #2a3747;
        background: rgba(20, 30, 40, 0.6);
      }

      .help sl-details::part(summary) {
        font-weight: 600;
        color: var(--text, #e7edf5);
      }

      .help-copy {
        margin: 0;
        color: var(--muted, #98a6b5);
        line-height: 1.45;
        font-size: 13px;
      }

      .help-body {
        display: grid;
        gap: 12px;
      }

      .actions {
        margin-top: 16px;
        display: flex;
        gap: 10px;
      }

      .pending {
        margin-top: 14px;
        padding: 12px;
        border-radius: 12px;
        border: 1px dashed #3a4a5c;
        color: var(--muted, #98a6b5);
        background: rgba(20, 30, 40, 0.6);
      }

      .steps {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .setup-controls {
        margin-top: 14px;
        display: grid;
        gap: 12px;
      }

      .setup-controls label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: var(--muted, #98a6b5);
      }

      .setup-controls select {
        max-width: 220px;
        border-radius: 10px;
        border: 1px solid #2b3b4c;
        background: #0e141b;
        color: var(--text, #e7edf5);
        padding: 8px 10px;
      }

      .setup-controls sl-select {
        max-width: 220px;
      }

      .setup-controls sl-select::part(base) {
        border-radius: 10px;
        border-color: #2b3b4c;
        background: #0e141b;
        color: var(--text, #e7edf5);
      }

      .cassette-teeth {
        margin-top: 10px;
        display: grid;
        gap: 8px;
      }

      .cassette-teeth-title {
        margin: 0;
        font-size: 12px;
        color: var(--muted, #98a6b5);
      }

      .cassette-teeth-row {
        display: grid;
        grid-template-columns: auto minmax(120px, 180px);
        gap: 10px;
        align-items: center;
      }

      .cassette-teeth-row span {
        font-size: 13px;
        color: var(--muted, #98a6b5);
      }

      .offset-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .offset-tune {
        border-radius: 12px;
        border: 1px solid #2a3747;
        background: rgba(20, 30, 40, 0.6);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .offset-tune-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: baseline;
      }

      .offset-tune-label {
        margin: 0;
        font-size: 13px;
        color: var(--muted, #98a6b5);
      }

      .offset-tune-value {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--text, #e7edf5);
      }

      .offset-tune-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        flex-wrap: nowrap;
      }

      .offset-error {
        margin: 0;
        color: #ff8a8a;
        font-size: 12px;
      }

      .preview {
        border-radius: 12px;
        border: 1px solid #2a3747;
        background: rgba(20, 30, 40, 0.6);
        overflow: hidden;
      }

      .preview-title {
        margin: 0;
        padding: 10px 12px;
        border-bottom: 1px solid #2a3747;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted, #98a6b5);
      }

      .preview-offset-empty {
        color: var(--muted, #98a6b5);
      }

      .step-panel {
        border-radius: 12px;
        border: 1px solid #2a3747;
        background: rgba(20, 30, 40, 0.6);
        padding: 12px;
        display: grid;
        gap: 10px;
      }

      .step-panel-copy {
        margin: 0;
        color: var(--muted, #98a6b5);
        font-size: 13px;
      }

      .step {
        border-radius: 12px;
        border: 1px solid #2a3747;
        background: rgba(20, 30, 40, 0.6);
        padding: 12px;
        display: grid;
        gap: 12px;
      }

      .step-head-row {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: flex-start;
      }

      .step-controls {
        border-top: 1px solid #223142;
        padding-top: 10px;
        display: grid;
        gap: 10px;
      }

      .step[data-complete="true"] {
        border-color: #2f6753;
        background: rgba(38, 96, 74, 0.24);
      }

      .step-head {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--text, #e7edf5);
      }

      .step-copy {
        margin: 4px 0 0;
        color: var(--muted, #98a6b5);
        font-size: 13px;
      }

      .step-status {
        white-space: nowrap;
        border-radius: 999px;
        border: 1px solid #3a4a5c;
        padding: 2px 10px;
        font-size: 11px;
        color: var(--muted, #98a6b5);
      }

      .step-status[data-complete="true"] {
        border-color: #2f6753;
        color: #9cecc9;
      }

      .finish-next {
        margin: 0;
        color: var(--muted, #98a6b5);
        font-size: 13px;
        line-height: 1.4;
      }

      .finish-link {
        color: var(--text, #e7edf5);
        text-decoration: underline;
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
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    const activeMac = appState.mac.get();
    if (appState.connected.get() && activeMac) {
      void appActions.ensureGearsForMac(activeMac);
    }
  }

  render() {
    const activeMac = appState.mac.get().toUpperCase();
    const configuredCogs = activeMac
      ? appState.gears.get()[activeMac]?.length
      : undefined;

    return html`
      <div class="card" data-test-id="setup">
        <div class="card-head">
          <h2>Setup</h2>
        </div>

        <p class="summary" data-test-id="setup-current-cog-count">
          Current configured cogs:
          <strong>${configuredCogs ?? "Unknown"}</strong>
        </p>

        <p class="copy">
          If the cog amount already matches your cassette, it is recommended to
          use Pod fine tuning for each position or the Cogs screen.
        </p>
        <p class="copy">
          If you want to reconfigure for another cassette with a different
          amount of cogs, press Start setup.
        </p>

        <section class="help" data-test-id="setup-help">
          <sl-details summary="ⓘ New here? Read this first">
            <div class="help-body">
              <p class="help-copy">
                Setup is your guided onboarding flow for configuring a cassette
                from scratch. It is best when you changed cassette type, changed
                cog count, or need to rebuild your full offset map.
              </p>

              <p class="help-copy">
                Use Setup when you installed a cassette with a different cog
                count or when your full cassette map no longer matches real
                shifting behavior. If only one or two gears need tiny
                corrections, Cogs is usually the better tool.
              </p>

              <p class="help-copy">
                During Setup, you define two anchor points: the smallest-cog
                offset and the largest-cog offset. OpenElin calculates all
                intermediate offsets between those points and writes the full
                rear-cog table (including tooth values) to NXS when you confirm
                Write to NXS.
              </p>

              <p class="help-copy">
                After writing, go to Cogs and verify shifting across every gear.
                If needed, apply small per-cog refinements there, then save the
                result as a profile so you can quickly reapply the same setup
                later.
              </p>

              <p class="help-copy">
                Safety tip: make small changes and test in a controlled
                environment before normal riding.
              </p>
            </div>
          </sl-details>
        </section>

        <div class="actions">
          <sl-button
            variant="primary"
            data-test-id="setup-start"
            @click=${this.startSetup}
          >
            Start setup
          </sl-button>
        </div>

        ${this.setupMode.get()
          ? html`
              <div class="pending" data-test-id="setup-mode-pending">
                Setup mode is enabled. Complete the steps below.
              </div>
              ${this.renderSetupFlow()}
            `
          : html``}
      </div>

      <sl-dialog
        data-test-id="setup-profile-dialog"
        label="Save profile"
        ?open=${this.profileDialogOpen.get()}
        @sl-request-close=${this.onProfileDialogRequestClose}
      >
        <sl-input
          data-test-id="setup-profile-dialog-input"
          label="Profile name"
          placeholder="Enter profile name"
          .value=${this.profileDialogValue.get()}
          ?invalid=${Boolean(this.profileDialogError.get())}
          help-text=${this.profileDialogError.get()}
          @sl-input=${this.onProfileDialogInput}
          ?disabled=${appState.cogsProfileWriteInProgress.get()}
        ></sl-input>
        <div slot="footer" class="dialog-actions">
          <sl-button
            data-test-id="setup-profile-dialog-cancel"
            class="dialog-cancel"
            ?disabled=${appState.cogsProfileWriteInProgress.get()}
            @click=${this.closeProfileDialog}
          >
            Cancel
          </sl-button>
          <sl-button
            data-test-id="setup-profile-dialog-confirm"
            variant="primary"
            ?disabled=${appState.cogsProfileWriteInProgress.get()}
            @click=${this.confirmSaveProfile}
          >
            Save
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }

  private renderSetupFlow() {
    const currentStep = this.currentStep.get();
    const cogCount = this.selectedCogCount.get();
    const rows = Array.from({ length: cogCount }, (_, index) => index + 1);
    const previewOffsets = this.getPreviewOffsets(cogCount);
    const offsetError = this.offsetValidationError.get();
    const interpolated = this.getInterpolatedOffsets(cogCount);
    const canWrite =
      currentStep === 3 &&
      interpolated !== null &&
      !offsetError &&
      !appState.cogsProfileWriteInProgress.get();
    const smallest = this.smallestOffset.get();
    const largest = this.largestOffset.get();
    const previewRows = [
      {
        label: "Cogs",
        values: rows.map((gearNumber) => String(gearNumber)),
        valueTestId: "setup-preview-gear",
      },
      {
        label: "Offsets",
        values: previewOffsets.map((value) => this.formatPreviewOffset(value)),
        valueTestId: "setup-preview-offset",
      },
    ];
    return html`
      <section class="setup-controls" data-test-id="setup-controls">
        ${this.renderStepIndicator(
          currentStep,
          cogCount,
          smallest,
          largest,
          canWrite,
          offsetError,
        )}
      </section>
      <section class="preview" data-test-id="setup-preview-table">
        <p class="preview-title">Cog preview</p>
        <cog-profile-meta-table
          table-test-id="setup-preview-meta-table"
          .count=${cogCount}
          .rows=${previewRows}
        ></cog-profile-meta-table>
      </section>
    `;
  }

  private renderStep1Controls(cogCount: number) {
    const teeth = this.getCassetteTeeth(cogCount);
    return html`
      <div data-test-id="setup-step-1-panel">
        <label for="setup-cog-count-select">
          Cog amount
          <sl-select
            id="setup-cog-count-select"
            data-test-id="setup-cog-count"
            value=${String(cogCount)}
            @sl-change=${this.onCogCountChange}
          >
            ${Array.from({ length: 10 }, (_, index) => 5 + index).map(
              (value) => html`
                <sl-option value=${String(value)}> ${value} </sl-option>
              `,
            )}
          </sl-select>
        </label>
        <div class="cassette-teeth" data-test-id="setup-cassette-teeth-list">
          <p class="cassette-teeth-title">
            Optional: set cassette cog tooth counts (defaults to 0)
          </p>
          ${Array.from({ length: cogCount }, (_, index) => index).map(
            (index) => html`
              <div class="cassette-teeth-row">
                <span>Cog ${index + 1}</span>
                <sl-input
                  type="number"
                  min="0"
                  max="255"
                  step="1"
                  data-test-id="setup-cassette-tooth-input"
                  data-cog-index=${String(index + 1)}
                  value=${String(teeth[index] ?? 0)}
                  @sl-input=${(event: Event) =>
                    this.onCassetteToothInput(index, event)}
                ></sl-input>
              </div>
            `,
          )}
        </div>
        <div class="actions">
          <sl-button
            variant="primary"
            data-test-id="setup-step1-next"
            @click=${this.goToStep2}
          >
            Continue to smallest offset
          </sl-button>
        </div>
      </div>
    `;
  }

  private renderStep2Controls(smallest: number | null, offsetError: string) {
    return html`
      <div data-test-id="setup-step-2-panel">
        <p class="step-panel-copy">
          Shift to the smallest cog first. The current position is used as your
          starting value for tuning.
        </p>
        <div class="offset-grid">
          <section class="offset-tune" data-test-id="setup-smallest-control">
            <div class="offset-tune-head">
              <p class="offset-tune-label">Smallest cog offset</p>
              <p
                class="offset-tune-value"
                data-test-id="setup-smallest-offset-value"
              >
                ${this.formatPreviewOffset(smallest)}
              </p>
            </div>
            <div class="offset-tune-controls">
              <tune-controls
                test-id-prefix="setup-smallest-tune"
                @tune-delta=${this.onSmallestOffsetTune}
              ></tune-controls>
            </div>
          </section>
        </div>
        <div class="actions">
          <sl-button data-test-id="setup-step2-back" @click=${this.goToStep1}>
            Back to cog amount
          </sl-button>
          <sl-button
            variant="primary"
            data-test-id="setup-step2-next"
            ?disabled=${smallest === null}
            @click=${this.goToStep3}
          >
            Continue to largest offset
          </sl-button>
        </div>
        ${offsetError
          ? html`<p class="offset-error" data-test-id="setup-offset-error">
              ${offsetError}
            </p>`
          : html``}
      </div>
    `;
  }

  private renderStep3Controls(
    largest: number | null,
    canWrite: boolean,
    offsetError: string,
  ) {
    return html`
      <div data-test-id="setup-step-3-panel">
        <p class="step-panel-copy">
          Set the largest cog offset to finalize interpolation across the
          cassette.
        </p>
        <div class="offset-grid">
          <section class="offset-tune" data-test-id="setup-largest-control">
            <div class="offset-tune-head">
              <p class="offset-tune-label">Largest cog offset</p>
              <p
                class="offset-tune-value"
                data-test-id="setup-largest-offset-value"
              >
                ${this.formatPreviewOffset(largest)}
              </p>
            </div>
            <div class="offset-tune-controls">
              <tune-controls
                test-id-prefix="setup-largest-tune"
                @tune-delta=${this.onLargestOffsetTune}
              ></tune-controls>
            </div>
          </section>
        </div>
        <div class="actions">
          <sl-button data-test-id="setup-step3-back" @click=${this.goToStep2}>
            Back to smallest offset
          </sl-button>
          <sl-button
            variant="primary"
            data-test-id="setup-write"
            ?disabled=${!canWrite}
            @click=${this.onWriteToNxs}
          >
            Write to NXS
          </sl-button>
        </div>
        ${offsetError
          ? html`<p class="offset-error" data-test-id="setup-offset-error">
              ${offsetError}
            </p>`
          : html``}
      </div>
    `;
  }

  private renderStepIndicator(
    currentStep: 1 | 2 | 3 | 4,
    cogCount: number,
    smallest: number | null,
    largest: number | null,
    canWrite: boolean,
    offsetError: string,
  ) {
    const step1Complete = this.isStep1Complete();
    const step2Complete = this.isStep2Complete();
    const step3Complete = this.isStep3Complete();
    const items = [
      {
        id: 1,
        title: "Set cog amount",
        copy: "Choose how many cogs the cassette uses.",
        complete: step1Complete,
      },
      {
        id: 2,
        title: "Set smallest cog offset",
        copy: "Shift to smallest cog and capture baseline offset.",
        complete: step2Complete,
      },
      {
        id: 3,
        title: "Set largest offset and interpolate",
        copy: "Set largest-cog offset, then calculate intermediate values.",
        complete: step3Complete,
      },
      {
        id: 4,
        title: "Finish",
        copy: "Optional next steps after writing setup to hub.",
        complete: this.currentStep.get() >= 4,
      },
    ];

    return html`
      <section
        class="steps"
        data-test-id="setup-steps"
        aria-label="Setup steps"
      >
        ${items.map(
          (item) => html`
            <article
              class="step"
              data-test-id=${`setup-step-${item.id}`}
              data-complete=${item.complete ? "true" : "false"}
            >
              <div class="step-head-row">
                <div>
                  <p class="step-head">Step ${item.id}: ${item.title}</p>
                  <p class="step-copy">${item.copy}</p>
                </div>
                <span
                  class="step-status"
                  data-test-id=${`setup-step-${item.id}-status`}
                  data-complete=${item.complete ? "true" : "false"}
                >
                  ${item.complete ? "Complete" : "Pending"}
                </span>
              </div>
              ${item.id === currentStep
                ? html`
                    <div class="step-controls">
                      ${item.id === 1
                        ? this.renderStep1Controls(cogCount)
                        : item.id === 2
                          ? this.renderStep2Controls(smallest, offsetError)
                          : item.id === 3
                            ? this.renderStep3Controls(
                                largest,
                                canWrite,
                                offsetError,
                              )
                            : this.renderStep4Controls()}
                    </div>
                  `
                : html``}
            </article>
          `,
        )}
      </section>
    `;
  }

  private isStep1Complete() {
    return this.setupMode.get() && this.currentStep.get() > 1;
  }

  private isStep2Complete() {
    if (!this.setupMode.get()) return false;
    return this.currentStep.get() > 2 && this.smallestOffset.get() !== null;
  }

  private isStep3Complete() {
    if (!this.isStep2Complete()) return false;
    const smallest = this.smallestOffset.get();
    const largest = this.largestOffset.get();
    if (smallest === null || largest === null) return false;
    return largest > smallest;
  }

  private startSetup() {
    this.currentStep.set(1);
    this.selectedCogCount.set(12);
    this.cassetteTeeth.set(Array.from({ length: 12 }, () => 0));
    this.smallestOffset.set(null);
    this.largestOffset.set(null);
    this.offsetValidationError.set("");
    this.profileDialogOpen.set(false);
    this.profileDialogValue.set("");
    this.profileDialogError.set("");
    this.setupMode.set(true);
  }

  private goToStep2 = async () => {
    if (this.smallestOffset.get() === null) {
      const currentOffset = await this.ensureCurrentAbsoluteOffset();
      if (currentOffset !== null) {
        this.smallestOffset.set(currentOffset);
      }
    }
    this.validateOffsets();
    this.currentStep.set(2);
  };

  private goToStep1 = () => {
    this.currentStep.set(1);
  };

  private goToStep3 = () => {
    const smallest = this.smallestOffset.get();
    if (smallest === null) return;
    if (this.largestOffset.get() === null) {
      this.largestOffset.set(smallest);
    }
    this.validateOffsets();
    this.currentStep.set(3);
  };

  private async ensureCurrentAbsoluteOffset() {
    const known = this.getCurrentAbsoluteOffset();
    if (known !== null) return known;
    await appActions.getPosition();
    return this.getCurrentAbsoluteOffset();
  }

  private getCurrentAbsoluteOffset() {
    const mac = appState.mac.get();
    const key = mac.toUpperCase();
    const gearList = key ? appState.gears.get()[key] : undefined;
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

  private onCogCountChange(event: Event) {
    const target = event.target as (EventTarget & { value?: string }) | null;
    const next = Number(target?.value ?? "");
    if (!Number.isInteger(next)) return;
    if (next < 5 || next > 14) return;
    this.selectedCogCount.set(next);
    this.cassetteTeeth.set(this.getCassetteTeeth(next));
    this.validateOffsets();
  }

  private onCassetteToothInput(index: number, event: Event) {
    const target = event.target as (EventTarget & { value?: string }) | null;
    const parsed = Number(target?.value ?? "");
    const normalized = Number.isFinite(parsed) ? Math.round(parsed) : 0;
    const clamped = Math.min(255, Math.max(0, normalized));
    const next = [...this.getCassetteTeeth(this.selectedCogCount.get())];
    next[index] = clamped;
    this.cassetteTeeth.set(next);
  }

  private onSmallestOffsetTune = (event: CustomEvent<{ delta: number }>) => {
    const current = this.smallestOffset.get() ?? 0;
    const next = Math.round((current + event.detail.delta) * 10) / 10;
    const target = clampOffsetToBounds(next);
    this.smallestOffset.set(target);
    this.validateOffsets();
  };

  private onLargestOffsetTune = (event: CustomEvent<{ delta: number }>) => {
    const current = this.largestOffset.get() ?? 0;
    const next = Math.round((current + event.detail.delta) * 10) / 10;
    const target = clampOffsetToBounds(next);
    this.largestOffset.set(target);
    this.validateOffsets();
  };

  private onWriteToNxs = async () => {
    const offsets = this.getInterpolatedOffsets(this.selectedCogCount.get());
    if (!offsets?.length) return;
    const teeth = this.getCassetteTeeth(this.selectedCogCount.get());
    const result = await appActions.writeSetupRearCogs(offsets, teeth);
    if (result.ok) {
      this.currentStep.set(4);
    }
  };

  private renderStep4Controls() {
    const saveDisabled =
      appState.cogsProfileWriteInProgress.get() ||
      this.getInterpolatedOffsets(this.selectedCogCount.get()) === null;
    return html`
      <div data-test-id="setup-step-4-panel">
        <p class="finish-next">
          <a
            class="finish-link"
            data-test-id="setup-finish-go-cogs"
            href=${this.getCogsHref()}
          >
            Go to Cogs
          </a>
          and tweak each cog for best performance.
        </p>
        <div class="actions">
          <sl-button
            variant="primary"
            data-test-id="setup-finish-save-profile"
            ?disabled=${saveDisabled}
            @click=${this.openProfileDialog}
          >
            Save current setup as profile
          </sl-button>
        </div>
      </div>
    `;
  }

  private getCogsHref() {
    const mac = appState.mac.get().trim().toUpperCase();
    const routeMac = encodeURIComponent(mac.replace(/:/g, "-"));
    return `/device/${routeMac}/cogs`;
  }

  private navigateToCogs() {
    const href = this.getCogsHref();
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
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

  private onProfileDialogRequestClose = (event: Event) => {
    if (appState.cogsProfileWriteInProgress.get()) {
      event.preventDefault();
      return;
    }
    this.closeProfileDialog();
  };

  private onProfileDialogInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    this.profileDialogValue.set(target?.value ?? "");
    if (this.profileDialogError.get()) {
      this.profileDialogError.set("");
    }
  };

  private confirmSaveProfile = () => {
    if (appState.cogsProfileWriteInProgress.get()) return;
    const offsets = this.getInterpolatedOffsets(this.selectedCogCount.get());
    if (!offsets?.length) {
      this.profileDialogError.set("No setup offsets to save.");
      return;
    }
    const teeth = this.getCassetteTeeth(this.selectedCogCount.get());
    const result = appActions.saveCogProfileFromEntries(
      this.profileDialogValue.get(),
      offsets.map((offset, index) => ({
        offset,
        toothCount: teeth[index] ?? 0,
      })),
    );
    if (!result.ok) {
      this.profileDialogError.set(result.message);
      return;
    }
    this.profileDialogOpen.set(false);
    this.profileDialogError.set("");
    this.navigateToCogs();
  };

  private validateOffsets() {
    const smallest = this.smallestOffset.get();
    const largest = this.largestOffset.get();
    const bounds = getOffsetBounds();
    if (smallest === null || largest === null) {
      this.offsetValidationError.set("");
      return;
    }
    if (
      smallest < bounds.min ||
      (bounds.max !== null && smallest > bounds.max)
    ) {
      this.offsetValidationError.set(
        bounds.max !== null
          ? `Smallest cog offset must stay between ${bounds.min} and ${bounds.max}.`
          : `Smallest cog offset must be at least ${bounds.min}.`,
      );
      return;
    }
    if (largest < bounds.min || (bounds.max !== null && largest > bounds.max)) {
      this.offsetValidationError.set(
        bounds.max !== null
          ? `Largest cog offset must stay between ${bounds.min} and ${bounds.max}.`
          : `Largest cog offset must be at least ${bounds.min}.`,
      );
      return;
    }
    if (largest <= smallest) {
      this.offsetValidationError.set(
        "Largest cog offset must be greater than smallest cog offset.",
      );
      return;
    }
    this.offsetValidationError.set("");
  }

  private getInterpolatedOffsets(cogCount: number) {
    const smallest = this.smallestOffset.get();
    const largest = this.largestOffset.get();
    if (smallest === null || largest === null) return null;
    if (largest <= smallest) return null;
    if (cogCount < 2) return null;
    const step = (largest - smallest) / (cogCount - 1);
    return Array.from(
      { length: cogCount },
      (_, index) => smallest + step * index,
    );
  }

  private getPreviewOffsets(cogCount: number): Array<number | null> {
    const interpolated = this.getInterpolatedOffsets(cogCount);
    if (interpolated) return interpolated;
    const values = Array.from(
      { length: cogCount },
      () => null as number | null,
    );
    const smallest = this.smallestOffset.get();
    if (smallest !== null && cogCount > 0) {
      values[0] = smallest;
      return values;
    }
    const currentOffset = this.getCurrentAbsoluteOffset();
    if (currentOffset !== null && cogCount > 0) {
      values[0] = currentOffset;
    }
    return values;
  }

  private getCassetteTeeth(cogCount: number) {
    const current = this.cassetteTeeth.get();
    return Array.from({ length: cogCount }, (_, index) => {
      const value = current[index];
      if (!Number.isFinite(value)) return 0;
      return Math.min(255, Math.max(0, Math.round(value)));
    });
  }

  private formatPreviewOffset(value: number | null) {
    if (value === null) return "--";
    return value.toFixed(2);
  }
}

if (!customElements.get("page-device-setup")) {
  customElements.define("page-device-setup", PageDeviceSetup);
}

export {};
