import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./refresh-button.ts";

class DeviceListTab extends SignalWatcher(LitElement) {
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

      .device-list {
        display: grid;
        gap: 14px;
      }

      .device-card {
        padding: 14px 16px;
        border-radius: 14px;
        background: #101822;
        border: 1px solid #233143;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .device-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .device-name {
        font-size: 16px;
        font-weight: 600;
      }

      .device-mac {
        font-size: 12px;
        color: var(--muted, #98a6b5);
      }

      .device-pill {
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        background: rgba(88, 110, 134, 0.2);
        color: #c0cad6;
      }

      .device-pill.ok {
        background: rgba(53, 194, 139, 0.18);
        color: #7ef0c3;
      }

      .device-pill.warn {
        background: rgba(255, 180, 84, 0.15);
        color: var(--warn, #ffb454);
      }

      .device-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin: 0;
      }

      .device-meta div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .device-meta dt {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted, #98a6b5);
      }

      .device-meta dd {
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

      @media (max-width: 900px) {
        .device-meta {
          grid-template-columns: 1fr;
        }
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
    if (appState.connected.get()) {
      void this.onGetList();
    }
  }

  render() {
    const canList = appState.connected.get();
    const entries = appState.listEntries.get();
    return html`
      <div class="card">
        <div class="card-head">
          <div class="card-head-row">
            <h2>Device list</h2>
            <refresh-button
              ?disabled=${!canList}
              .loading=${this.loading}
              @refresh-requested=${this.onGetList}
            ></refresh-button>
          </div>
          <p class="hint">Scan the hub for linked devices.</p>
        </div>
        ${entries.length
          ? html`<div class="device-list" role="list">
              ${entries.map((entry) => this.renderEntry(entry))}
            </div>`
          : html`
              <div class="empty-state" role="status" aria-live="polite">
                No device list loaded yet.
              </div>
            `}
      </div>
    `;
  }

  private async onGetList() {
    if (this.loading) return;
    this.loading = true;
    try {
      await appActions.getList();
    } finally {
      this.loading = false;
    }
  }

  private renderEntry(entry: {
    name?: string;
    mac?: string;
    deviceId?: number;
    isConnected?: boolean;
    batteryVoltage?: number;
    rssi?: number;
  }) {
    const name = entry.name || "Unknown device";
    const mac = entry.mac || "--";
    const deviceId = entry.deviceId ?? "--";
    const rssi = entry.rssi ?? "--";
    const batteryText = this.formatBattery(entry.batteryVoltage);
    return html`
      <div class="device-card" role="listitem">
        <div class="device-header">
          <div>
            <div class="device-name">${name}</div>
            <div class="device-mac">${mac}</div>
          </div>
          <div class="device-pill ${entry.isConnected ? "ok" : "warn"}">
            ${entry.isConnected ? "Connected" : "Offline"}
          </div>
        </div>
        <dl class="device-meta">
          <div>
            <dt>Device ID</dt>
            <dd>${deviceId}</dd>
          </div>
          <div>
            <dt>Battery</dt>
            <dd>${batteryText}</dd>
          </div>
          <div>
            <dt>RSSI</dt>
            <dd>${rssi}</dd>
          </div>
        </dl>
      </div>
    `;
  }

  private formatBattery(value?: number) {
    if (value === undefined || value === null) return "--";
    const volts = (value / 1000).toFixed(2);
    return `${volts} V (${value} mV)`;
  }
}

customElements.define("device-list-tab", DeviceListTab);

export {};
