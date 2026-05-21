import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, PropertyValues, css, html, nothing } from "lit";

import "../demo/pod-mock-gui.ts";
import { devicePages } from "../device-pages.ts";
import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./connection-empty-state.ts";
import "./inline-spinner.ts";
import "./page-device-buttons.ts";
import "./page-device-cogs.ts";
import "./page-device-list.ts";
import "./page-device-log.ts";
import "./page-device-motor.ts";
import "./page-device-setup.ts";

export class ShellDevice extends SignalWatcher(LitElement) {
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
    activePage: { type: String, attribute: "active-page" },
    renameOpen: { type: Boolean, attribute: false },
    renameValue: { type: String, attribute: false },
    renameError: { type: String, attribute: false },
    renameBusy: { type: Boolean, attribute: false },
  };

  declare macValue: string;
  declare activePage: string;
  declare renameOpen: boolean;
  declare renameValue: string;
  declare renameError: string;
  declare renameBusy: boolean;

  protected updated(changed: PropertyValues) {
    if (changed.has("activePage")) {
      appActions.setActivePage(this.activePage);
    }
  }

  constructor() {
    super();
    this.macValue = "";
    this.activePage = "log";
    this.renameOpen = false;
    this.renameValue = "";
    this.renameError = "";
    this.renameBusy = false;
  }

  render() {
    const connected = appState.connected.get();
    if (!connected) {
      return html`
        <connection-empty-state
          @connect-action=${this.onReconnect}
          @demo-action=${this.onDemo}
        ></connection-empty-state>
      `;
    }

    const deviceName = appState.connectedDevice.get()?.name || "Unknown";
    const displayMac = this.macValue || "Unknown";
    const activePage = this.activePage || "log";
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
                    data-test-id="device-disconnect-button"
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
              <div class="sidebar-mac" data-test-id="device-sidebar-mac">
                ${displayMac}
              </div>
              <div
                class="status ${batteryStatus.kind}"
                data-test-id="device-sidebar-battery-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                ${batteryStatus.label}
              </div>
            </div>
            <nav class="nav-list" aria-label="Device navigation">
              ${devicePages.map((page) =>
                this.renderNavLink(page.id, page.label, activePage, displayMac),
              )}
            </nav>
          </div>
          ${isDemo ? html`<pod-mock-gui></pod-mock-gui>` : html``}
        </aside>
        <div class="content">${this.renderDevicePage(activePage)}</div>
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
    pageId: string,
    label: string,
    activePage: string,
    macValue: string,
  ) {
    const href = macValue
      ? `/device/${macValue.replace(/:/g, "-")}/${pageId}`
      : "/";
    return html`
      <a
        class="nav-link ${activePage === pageId ? "active" : ""}"
        data-test-id=${`device-nav-${pageId}`}
        href=${href}
        aria-current=${activePage === pageId ? "page" : nothing}
      >
        ${label}
      </a>
    `;
  }

  private renderDevicePage(activePage: string) {
    switch (activePage) {
      case "list":
        return html`<page-device-list></page-device-list>`;
      case "motor":
        return html`<page-device-motor></page-device-motor>`;
      case "buttons":
        return html`<page-device-buttons></page-device-buttons>`;
      case "cogs":
        return html`<page-device-cogs></page-device-cogs>`;
      case "setup":
        return html`<page-device-setup></page-device-setup>`;
      case "log":
      default:
        return html`<page-device-log></page-device-log>`;
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

  private onRenameRequestClose(event: Event) {
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

if (!customElements.get("shell-device")) {
  customElements.define("shell-device", ShellDevice);
}

export {};
