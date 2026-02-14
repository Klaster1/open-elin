import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./refresh-button.ts";

class DeviceListTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

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
          ? html`<div class="device-list">
              ${entries.map((entry) => this.renderEntry(entry))}
            </div>`
          : html`<div class="empty-state">No device list loaded yet.</div>`}
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
      <div class="device-card">
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
