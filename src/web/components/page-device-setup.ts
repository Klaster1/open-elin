import { LitElement, css, html } from "lit";
import { SignalWatcher, signal } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./tune-controls.ts";

export class PageDeviceSetup extends SignalWatcher(LitElement) {
  private setupMode = signal(false);
  private currentStep = signal<1 | 2 | 3>(1);
  private selectedCogCount = signal(12);
  private smallestOffset = signal<number | null>(null);
  private largestOffset = signal<number | null>(null);
  private offsetValidationError = signal("");

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

      .preview-table {
        width: 100%;
        border-collapse: collapse;
      }

      .preview-table th,
      .preview-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #223142;
        font-size: 13px;
      }

      .preview-table tr:last-child td {
        border-bottom: none;
      }

      .preview-table th {
        color: var(--muted, #98a6b5);
        font-weight: 600;
      }

      .preview-offset-empty {
        color: var(--muted, #98a6b5);
      }

      .step {
        border-radius: 12px;
        border: 1px solid #2a3747;
        background: rgba(20, 30, 40, 0.6);
        padding: 12px;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: flex-start;
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
          <p class="hint">Cassette reconfiguration flow.</p>
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
              ${this.renderStepIndicator()} ${this.renderSetupControls()}
            `
          : html``}
      </div>
    `;
  }

  private renderSetupControls() {
    const currentStep = this.currentStep.get();
    const cogCount = this.selectedCogCount.get();
    const rows = Array.from({ length: cogCount }, (_, index) => index + 1);
    const previewOffsets = this.getPreviewOffsets(cogCount);
    const smallest = this.smallestOffset.get();
    const largest = this.largestOffset.get();
    const offsetError = this.offsetValidationError.get();
    return html`
      <section class="setup-controls" data-test-id="setup-controls">
        ${currentStep === 1
          ? html`
              <label for="setup-cog-count-select">
                Cog amount
                <select
                  id="setup-cog-count-select"
                  data-test-id="setup-cog-count"
                  @change=${this.onCogCountChange}
                >
                  ${Array.from({ length: 10 }, (_, index) => 5 + index).map(
                    (value) => html`
                      <option
                        value=${String(value)}
                        ?selected=${value === cogCount}
                      >
                        ${value}
                      </option>
                    `,
                  )}
                </select>
              </label>
            `
          : html``}
        ${currentStep === 2
          ? html`
              <div class="offset-grid">
                <section
                  class="offset-tune"
                  data-test-id="setup-smallest-control"
                >
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
            `
          : html``}
        ${currentStep === 3
          ? html`
              <div class="offset-grid">
                <section
                  class="offset-tune"
                  data-test-id="setup-largest-control"
                >
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
            `
          : html``}
        ${offsetError
          ? html`<p class="offset-error" data-test-id="setup-offset-error">
              ${offsetError}
            </p>`
          : html``}

        <section class="preview" data-test-id="setup-preview-table">
          <p class="preview-title">Cog preview</p>
          <table class="preview-table">
            <thead>
              <tr>
                <th>Cog</th>
                <th>Offset</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                (gearNumber) => html`
                  <tr
                    data-test-id="setup-preview-row"
                    data-gear-number=${gearNumber}
                  >
                    <td>${gearNumber}</td>
                    <td
                      class=${previewOffsets[gearNumber - 1] === null
                        ? "preview-offset-empty"
                        : ""}
                      data-test-id="setup-preview-offset"
                    >
                      ${this.formatPreviewOffset(
                        previewOffsets[gearNumber - 1],
                      )}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </section>

        <div class="actions">
          ${currentStep === 1
            ? html`
                <sl-button
                  variant="primary"
                  data-test-id="setup-step1-next"
                  @click=${this.goToStep2}
                >
                  Continue to smallest offset
                </sl-button>
              `
            : html``}
          ${currentStep === 2
            ? html`
                <sl-button
                  data-test-id="setup-step2-back"
                  @click=${this.goToStep1}
                >
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
              `
            : html``}
          ${currentStep === 3
            ? html`
                <sl-button
                  data-test-id="setup-step3-back"
                  @click=${this.goToStep2}
                >
                  Back to smallest offset
                </sl-button>
              `
            : html``}
        </div>
      </section>
    `;
  }

  private renderStepIndicator() {
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
        copy: "Capture the smallest-cog baseline offset.",
        complete: step2Complete,
      },
      {
        id: 3,
        title: "Set largest offset and interpolate",
        copy: "Set largest-cog offset, then calculate intermediate values.",
        complete: step3Complete,
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
    this.smallestOffset.set(null);
    this.largestOffset.set(null);
    this.offsetValidationError.set("");
    this.setupMode.set(true);
  }

  private goToStep2 = () => {
    this.currentStep.set(2);
  };

  private goToStep1 = () => {
    this.currentStep.set(1);
  };

  private goToStep3 = () => {
    if (this.smallestOffset.get() === null) return;
    this.currentStep.set(3);
  };

  private onCogCountChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const next = Number(target?.value ?? "");
    if (!Number.isInteger(next)) return;
    if (next < 5 || next > 14) return;
    this.selectedCogCount.set(next);
    this.validateOffsets();
  }

  private onSmallestOffsetTune = (event: CustomEvent<{ delta: number }>) => {
    const current = this.smallestOffset.get() ?? 0;
    const target = Math.round((current + event.detail.delta) * 10) / 10;
    this.smallestOffset.set(target);
    this.validateOffsets();
  };

  private onLargestOffsetTune = (event: CustomEvent<{ delta: number }>) => {
    const current = this.largestOffset.get() ?? 0;
    const target = Math.round((current + event.detail.delta) * 10) / 10;
    this.largestOffset.set(target);
    this.validateOffsets();
  };

  private validateOffsets() {
    const smallest = this.smallestOffset.get();
    const largest = this.largestOffset.get();
    if (smallest === null || largest === null) {
      this.offsetValidationError.set("");
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
    }
    return values;
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
