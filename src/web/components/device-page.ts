import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import { deviceTabs } from "../device-tabs.ts";
import "./empty-state.ts";
import "./device-list-tab.ts";
import "./device-motor-tab.ts";
import "./device-buttons-tab.ts";
import "./device-cogs-tab.ts";
import "./device-log-tab.ts";
import "./inline-spinner.ts";
import "./pod-mock-gui.ts";

class DevicePage extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  static properties = {
    macValue: { type: String, attribute: "mac-value" },
    activeTab: { type: String, attribute: "active-tab" },
    renameOpen: { type: Boolean, attribute: false },
    renameValue: { type: String, attribute: false },
    renameError: { type: String, attribute: false },
    renameBusy: { type: Boolean, attribute: false },
  };

  declare macValue: string;
  declare activeTab: string;
  declare renameOpen: boolean;
  declare renameValue: string;
  declare renameError: string;
  declare renameBusy: boolean;

  constructor() {
    super();
    this.macValue = "";
    this.activeTab = "log";
    this.renameOpen = false;
    this.renameValue = "";
    this.renameError = "";
    this.renameBusy = false;
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
    const isDemo = appState.demoMode.get();

    return html`
      <section class="shell">
        <aside class="card sidebar">
          <div class="sidebar-head">
            <div class="sidebar-name-row">
              <div class="sidebar-name">${deviceName}</div>
              <button
                class="icon-button"
                type="button"
                @click=${this.openRename}
                aria-label="Rename hub"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20h4l10.5-10.5-4-4L4 16v4zM14.5 5.5l4 4"></path>
                </svg>
              </button>
            </div>
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
      ${isDemo ? html`<pod-mock-gui></pod-mock-gui>` : html``}
      <sl-dialog
        label="Rename hub"
        ?open=${this.renameOpen}
        @sl-request-close=${this.onRenameRequestClose}
      >
        <sl-input
          label="New name"
          placeholder="Enter hub name"
          .value=${this.renameValue}
          ?invalid=${Boolean(this.renameError)}
          help-text=${this.renameError}
          @sl-input=${this.onRenameInput}
          ?disabled=${this.renameBusy}
        ></sl-input>
        <div slot="footer" class="dialog-actions">
          <sl-button
            class="dialog-cancel"
            ?disabled=${this.renameBusy}
            @click=${this.closeRename}
          >
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?disabled=${this.renameBusy}
            @click=${this.confirmRename}
          >
            ${this.renameBusy
              ? html`<inline-spinner slot="prefix"></inline-spinner>`
              : html``}
            Rename
          </sl-button>
        </div>
      </sl-dialog>
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

  private openRename() {
    const currentName = appState.connectedDevice.get()?.name || "";
    this.renameValue = currentName;
    this.renameError = "";
    this.renameOpen = true;
  }

  private closeRename() {
    this.renameOpen = false;
    this.renameError = "";
  }

  private onRenameRequestClose() {
    if (this.renameBusy) {
      event.preventDefault();
      return;
    }
    this.closeRename();
  }

  private onRenameInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.renameValue = target?.value ?? "";
    if (this.renameError) {
      this.renameError = "";
    }
  }

  private async confirmRename() {
    const trimmed = this.renameValue.trim();
    if (!trimmed) {
      this.renameError = "Name is required.";
      return;
    }
    if (this.renameBusy) return;
    this.renameBusy = true;
    try {
      const response = await appActions.renameHub(trimmed);
      if (response?.status === "success") {
        this.renameOpen = false;
        this.renameError = "";
        return;
      }
      this.renameError = "Rename failed. Try again.";
    } finally {
      this.renameBusy = false;
    }
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
