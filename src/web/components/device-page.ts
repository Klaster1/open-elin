import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import { deviceTabs } from "../device-tabs.ts";
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
          <div class="card empty-state stack">
            <div class="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M12 28c10-10 30-10 40 0"
                  stroke="#7ef0c3"
                  stroke-width="4"
                  stroke-linecap="round"
                />
                <path
                  d="M20 36c6-6 18-6 24 0"
                  stroke="#7ef0c3"
                  stroke-width="4"
                  stroke-linecap="round"
                />
                <path
                  d="M28 44c2-2 6-2 8 0"
                  stroke="#7ef0c3"
                  stroke-width="4"
                  stroke-linecap="round"
                />
                <circle cx="32" cy="50" r="3" fill="#ffb454" />
              </svg>
            </div>
            <h2 class="empty-title">Reconnect required</h2>
            <p class="hint empty-message">
              You opened the device page without an active Bluetooth session.
              Chrome requires a user click to open the Bluetooth picker.
            </p>
            <sl-button variant="primary" @click=${this.onReconnect}
              >Connect to hub</sl-button
            >
          </div>
        </section>
      `;
    }

    const displayMac = this.macValue || "Unknown";
    const activeTab = this.activeTab || "log";

    return html`
      <section class="shell">
        <aside class="card sidebar">
          <div class="sidebar-head">
            <div class="sidebar-title">Active hub</div>
            <div class="sidebar-mac">${displayMac}</div>
            <div class="status ok">Connected</div>
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
      ? `#!/device/${encodeURIComponent(macValue)}/${tabId}`
      : "#!/";
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
}

customElements.define("device-page", DevicePage);

export {};
