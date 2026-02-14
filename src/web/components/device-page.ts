import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import { deviceTabs } from "../device-tabs.ts";
import "./empty-state.ts";
import "./device-list-tab.ts";
import "./device-motor-tab.ts";
import "./device-buttons-tab.ts";
import "./device-cogs-tab.ts";
import "./device-log-tab.ts";

class DevicePage extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  static properties = {
    macValue: { type: String, attribute: "mac-value" },
    activeTab: { type: String, attribute: "active-tab" },
  };

  declare macValue: string;
  declare activeTab: string;

  constructor() {
    super();
    this.macValue = "";
    this.activeTab = "log";
  }

  render() {
    const connected = appState.connected.get();
    if (!connected) {
      return html`
        <section>
          <empty-state
            title="Reconnect required"
            message="You opened the device page without an active Bluetooth session. Chrome requires a user click to open the Bluetooth picker."
          >
            <div slot="actions" class="actions">
              <sl-button variant="primary" @click=${this.onReconnect}
                >Connect to hub</sl-button
              >
              <sl-button class="demo-button" @click=${this.onDemo}
                >Demo</sl-button
              >
            </div>
          </empty-state>
        </section>
      `;
    }

    const deviceName = appState.connectedDevice.get()?.name || "Unknown";
    const displayMac = this.macValue || "Unknown";
    const activeTab = this.activeTab || "log";
    const battery = appState.hubBatteryVoltage.get();
    const batteryStatus = this.formatBatteryStatus(battery);

    return html`
      <section class="shell">
        <aside class="card sidebar">
          <div class="sidebar-head">
            <div class="sidebar-name">${deviceName}</div>
            <div class="sidebar-mac">${displayMac}</div>
            <div class="status ${batteryStatus.kind}">
              ${batteryStatus.label}
            </div>
          </div>
          <nav class="nav-list">
            ${deviceTabs.map((tab) =>
              this.renderNavLink(tab.id, tab.label, activeTab, displayMac),
            )}
          </nav>
        </aside>
        <div class="content">${this.renderDeviceTab(activeTab)}</div>
      </section>
    `;
  }

  private renderNavLink(
    tabId: string,
    label: string,
    activeTab: string,
    macValue: string,
  ) {
    const href = macValue
      ? `/device/${encodeURIComponent(macValue)}/${tabId}`
      : "/";
    return html`
      <a class="nav-link ${activeTab === tabId ? "active" : ""}" href=${href}
        >${label}</a
      >
    `;
  }

  private renderDeviceTab(activeTab: string) {
    switch (activeTab) {
      case "list":
        return html`<device-list-tab></device-list-tab>`;
      case "motor":
        return html`<device-motor-tab></device-motor-tab>`;
      case "buttons":
        return html`<device-buttons-tab></device-buttons-tab>`;
      case "cogs":
        return html`<device-cogs-tab></device-cogs-tab>`;
      case "log":
      default:
        return html`<device-log-tab></device-log-tab>`;
    }
  }

  private onReconnect() {
    this.dispatchEvent(
      new CustomEvent("reconnect-requested", { bubbles: true, composed: true }),
    );
  }

  private onDemo() {
    this.dispatchEvent(
      new CustomEvent("demo-requested", { bubbles: true, composed: true }),
    );
  }

  private formatBatteryStatus(value: number | null) {
    if (value === null || value === undefined) {
      return { label: "Battery --", kind: "wait" };
    }

    const volts = value / 1000;
    const percent = this.voltageToPercent(volts);
    const kind = percent >= 70 ? "ok" : percent >= 40 ? "warn" : "crit";
    return {
      label: `Battery ${volts.toFixed(2)} V • ${percent}%`,
      kind,
    };
  }

  private voltageToPercent(volts: number) {
    const min = 3.2;
    const max = 4.2;
    const clamped = Math.min(Math.max(volts, min), max);
    return Math.round(((clamped - min) / (max - min)) * 100);
  }
}

customElements.define("device-page", DevicePage);

export {};
