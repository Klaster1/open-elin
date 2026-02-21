import { LitElement, css, html, nothing } from "lit";
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

export class DevicePage extends SignalWatcher(LitElement) {
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

      .shell {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 16px;
        position: sticky;
        top: 20px;
      }

      .sidebar-head {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .sidebar-name {
        font-size: 13px;
        color: var(--muted, #98a6b5);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .sidebar-name-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .sidebar-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid #233143;
        background: #0f1620;
        color: inherit;
        cursor: pointer;
      }

      .icon-button:hover {
        border-color: #2b3a4b;
        background: #18222f;
      }

      .icon-button svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .sidebar-mac {
        font-size: 18px;
        font-weight: 600;
        color: var(--text, #e7edf5);
      }

      .nav-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .nav-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 12px;
        background: #0f1620;
        border: 1px solid transparent;
        color: inherit;
        text-decoration: none;
        font-weight: 600;
        transition:
          border-color 0.2s ease,
          background 0.2s ease;
      }

      .nav-link:hover {
        border-color: #2b3a4b;
        background: #18222f;
      }

      .nav-link.active {
        border-color: #3a4a5c;
        background: #1c2836;
        color: #e7edf5;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        background: #243243;
        color: var(--muted, #98a6b5);
      }

      .status.ok {
        background: rgba(53, 194, 139, 0.18);
        color: #7ef0c3;
      }

      .status.warn {
        background: rgba(255, 180, 84, 0.15);
        color: var(--warn, #ffb454);
      }

      .status.crit {
        background: rgba(255, 102, 102, 0.16);
        color: #ff8a8a;
      }

      .status.wait {
        background: rgba(88, 110, 134, 0.2);
        color: #c0cad6;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .dialog-cancel {
        margin-right: auto;
      }

      sl-dialog::part(header) {
        padding: 6px 10px 0;
      }

      sl-dialog::part(body) {
        padding: 4px 10px 0;
      }

      sl-dialog::part(footer) {
        padding: 4px 10px 8px;
      }

      sl-dialog::part(close-button) {
        display: none;
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

      .demo-button::part(base) {
        background: transparent;
        border-color: #2b3a4b;
        color: var(--muted, #98a6b5);
        opacity: 0.7;
      }

      .demo-button::part(base):hover {
        opacity: 1;
        border-color: #3a4a5c;
        color: var(--text, #e7edf5);
      }

      @media (max-width: 900px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          position: static;
        }
      }
    `,
  ];

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
        <section role="main" aria-label="Reconnect">
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
      <section class="shell" role="main" aria-label="Device details">
        <aside class="sidebar">
          <div class="card">
            <div class="sidebar-head">
              <div class="sidebar-name-row">
                <div class="sidebar-name" data-test-id="device-sidebar-name">
                  ${deviceName}
                </div>
                <div class="sidebar-actions">
                  <button
                    class="icon-button"
                    type="button"
                    data-test-id="device-rename-button"
                    @click=${this.openRename}
                    aria-label="Rename hub"
                    title="Rename hub"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 20h4l10.5-10.5-4-4L4 16v4zM14.5 5.5l4 4"
                      ></path>
                    </svg>
                  </button>
                  <button
                    class="icon-button"
                    type="button"
                    @click=${this.onDisconnect}
                    aria-label="Disconnect"
                    title="Disconnect"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="sidebar-mac">${displayMac}</div>
              <div
                class="status ${batteryStatus.kind}"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                ${batteryStatus.label}
              </div>
            </div>
            <nav class="nav-list" aria-label="Device navigation">
              ${deviceTabs.map((tab) =>
                this.renderNavLink(tab.id, tab.label, activeTab, displayMac),
              )}
            </nav>
          </div>
          ${isDemo ? html`<pod-mock-gui></pod-mock-gui>` : html``}
        </aside>
        <div class="content">${this.renderDeviceTab(activeTab)}</div>
      </section>
      <sl-dialog
        data-test-id="device-rename-dialog"
        label="Rename hub"
        ?open=${this.renameOpen}
        @sl-request-close=${this.onRenameRequestClose}
      >
        <sl-input
          data-test-id="device-rename-input"
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
            data-test-id="device-rename-cancel"
            class="dialog-cancel"
            ?disabled=${this.renameBusy}
            @click=${this.closeRename}
          >
            Cancel
          </sl-button>
          <sl-button
            data-test-id="device-rename-confirm"
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
      ? `/device/${macValue.replace(/:/g, "-")}/${tabId}`
      : "/";
    return html`
      <a
        class="nav-link ${activeTab === tabId ? "active" : ""}"
        data-test-id=${`device-nav-${tabId}`}
        href=${href}
        aria-current=${activeTab === tabId ? "page" : nothing}
      >
        ${label}
      </a>
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

  private onDisconnect() {
    this.dispatchEvent(
      new CustomEvent("disconnect-requested", {
        bubbles: true,
        composed: true,
      }),
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

if (!customElements.get("device-page")) {
  customElements.define("device-page", DevicePage);
}

export {};
