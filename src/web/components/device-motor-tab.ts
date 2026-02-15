import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./refresh-button.ts";

class DeviceMotorTab extends SignalWatcher(LitElement) {
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

      .card-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .param-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 0;
      }

      .param-grid div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .param-grid dt {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted, #98a6b5);
      }

      .param-grid dd {
        margin: 0;
        font-size: 14px;
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
    `,
  ];

  static properties = {
    loading: { type: Boolean, attribute: false },
  };

  declare loading: boolean;

  constructor() {
    super();
    this.loading = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (appState.connected.get() && appState.mac.get()) {
      void this.onGetMotorParams();
    }
  }

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const motorParams = appState.motorParams.get();
    const entries = motorParams ? this.buildMotorEntries(motorParams) : [];
    return html`
      <div class="card">
        <div class="card-head">
          <div class="card-head-row">
            <h2>Motor params</h2>
            <refresh-button
              ?disabled=${!canSend}
              .loading=${this.loading}
              @refresh-requested=${this.onGetMotorParams}
            ></refresh-button>
          </div>
          <p class="hint">Latest motor configuration snapshot.</p>
        </div>
        ${entries.length
          ? html`<dl class="param-grid">
              ${entries.map(
                (entry) => html`
                  <div>
                    <dt>${entry.label}</dt>
                    <dd>${entry.value}</dd>
                  </div>
                `,
              )}
            </dl>`
          : html`<div class="empty-state">No motor params fetched yet.</div>`}
      </div>
    `;
  }

  private async onGetMotorParams() {
    if (this.loading) return;
    this.loading = true;
    try {
      await appActions.getMotorParams();
    } finally {
      this.loading = false;
    }
  }

  private buildMotorEntries(value: any) {
    const readable = value?.humanReadable ?? value;
    if (!readable || typeof readable !== "object")
      return [] as Array<{
        label: string;
        value: string;
      }>;

    const knownKeys = [
      "stallDetection",
      "pwmFrequency",
      "accelRampTimer",
      "rampStartDutyCycle",
      "overshiftDistance",
      "overshiftDelay",
      "multishiftDelay",
    ];
    const labels: Record<string, string> = {
      stallDetection: "Stall detection",
      pwmFrequency: "PWM frequency",
      accelRampTimer: "Accel ramp timer",
      rampStartDutyCycle: "Ramp start duty",
      overshiftDistance: "Overshift distance",
      overshiftDelay: "Overshift delay",
      multishiftDelay: "Multishift delay",
    };

    const hasKnown = knownKeys.some((key) => key in readable);
    const entries = hasKnown
      ? knownKeys
          .filter((key) => key in readable)
          .map((key) => ({
            label: labels[key] ?? this.formatLabel(key),
            value: this.formatValue(readable[key]),
          }))
      : Object.entries(readable).map(([key, item]) => ({
          label: this.formatLabel(key),
          value: this.formatValue(item),
        }));

    if (value?.rawHex) {
      entries.push({ label: "Raw hex", value: value.rawHex });
    }

    return entries;
  }

  private formatLabel(key: string) {
    return key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatValue(value: unknown) {
    if (value === null || value === undefined) return "--";
    if (typeof value === "number") return value.toString();
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }
}

customElements.define("device-motor-tab", DeviceMotorTab);

export {};
