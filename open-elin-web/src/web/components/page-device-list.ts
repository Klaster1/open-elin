import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./refresh-button.ts";

export class PageDeviceList extends SignalWatcher(LitElement) {
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
    addPodOpen: { type: Boolean, attribute: false },
    addPodMac: { type: String, attribute: false },
    renameOpen: { type: Boolean, attribute: false },
    renameValue: { type: String, attribute: false },
    renameError: { type: String, attribute: false },
    renameBusy: { type: Boolean, attribute: false },
  };

  declare loading: boolean;
  declare addPodOpen: boolean;
  declare addPodMac: string;
  declare renameOpen: boolean;
  declare renameValue: string;
  declare renameError: string;
  declare renameBusy: boolean;

  constructor() {
    super();
    this.loading = false;
    this.addPodOpen = false;
    this.addPodMac = "";
    this.renameOpen = false;
    this.renameValue = "";
    this.renameError = "";
    this.renameBusy = false;
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
      <div class="card" data-test-id="device-list">
        <div class="card-head">
          <div class="card-head-row">
            <h2>Device list</h2>
            <div style="display:flex;gap:8px;align-items:center;">
              <sl-button
                size="small"
                variant="primary"
                data-test-id="device-list-set-bikenet"
                ?disabled=${!canList}
                @click=${this.onSetBikenet}
              >Set BikeNet</sl-button>
              <sl-button
                size="small"
                variant="default"
                data-test-id="device-list-add-pod"
                ?disabled=${!canList}
                @click=${this.onAddPodOpen}
              >Add Pod</sl-button>
              <refresh-button
                data-test-id="device-list-refresh"
                ?disabled=${!canList}
                .loading=${this.loading}
                @refresh-requested=${this.onGetList}
              ></refresh-button>
            </div>
          </div>
          <p class="hint">Scan the hub for linked devices.</p>
        </div>
        ${this.renderHubCard()}
        ${entries.length
          ? html`<div
              class="device-list"
              role="list"
              data-test-id="device-list-entries"
            >
              ${entries.map((entry) => this.renderEntry(entry))}
            </div>`
          : html`
              <div
                class="empty-state"
                role="status"
                aria-live="polite"
                data-test-id="device-list-empty"
              >
                No device list loaded yet.
              </div>
            `}
      </div>
      <sl-dialog
        data-test-id="add-pod-dialog"
        label="Add Pod"
        ?open=${this.addPodOpen}
        @sl-request-close=${this.onAddPodClose}
      >
        <sl-input
          data-test-id="add-pod-mac-input"
          label="Pod MAC address"
          placeholder="D5:89:B2:13:FA:04"
          .value=${this.addPodMac}
          @sl-input=${this.onAddPodMacInput}
        ></sl-input>
        <sl-button
          slot="footer"
          variant="primary"
          data-test-id="add-pod-confirm"
          @click=${this.onAddPodConfirm}
        >Add</sl-button>
      </sl-dialog>
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
        <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;">
          <sl-button
            data-test-id="device-rename-cancel"
            ?disabled=${this.renameBusy}
            @click=${this.closeRename}
          >Cancel</sl-button>
          <sl-button
            data-test-id="device-rename-confirm"
            variant="primary"
            ?disabled=${this.renameBusy}
            @click=${this.confirmRename}
          >
            ${this.renameBusy ? html`<inline-spinner slot="prefix"></inline-spinner>` : html``}
            Rename
          </sl-button>
        </div>
      </sl-dialog>
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

  private async onSetBikenet() {
    await appActions.setBikenet();
    await this.onGetList();
  }

  private async onCalibrate() {
    await appActions.calibrate();
  }

  private async onBlink() {
    await appActions.blinkLed();
  }

  private async onHome() {
    await appActions.motorHome();
  }

  private onSleep() {
    this.dispatchEvent(
      new CustomEvent("sleep-requested", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onRenameOpen() {
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

  private onAddPodOpen() {
    this.addPodMac = "";
    this.addPodOpen = true;
  }

  private onAddPodClose() {
    this.addPodOpen = false;
  }

  private onAddPodMacInput(e: Event) {
    const input = e.target as HTMLElement & { value: string };
    this.addPodMac = input.value;
  }

  private async onAddPodConfirm() {
    const mac = this.addPodMac.trim();
    this.addPodOpen = false;
    await appActions.addDevice(mac);
  }

  private renderHubCard() {
    const device = appState.connectedDevice.get();
    const mac = appState.mac.get() || "--";
    const battery = appState.hubBatteryVoltage.get();
    const name = device?.name || "Hub";
    const batteryText = this.formatBattery(battery);
    return html`
      <div class="device-card" data-test-id="device-list-hub-card" style="margin-bottom:14px;">
        <div class="device-header">
          <div>
            <div class="device-name" data-test-id="device-list-name">${name}</div>
            <div class="device-mac" data-test-id="device-list-mac">${mac}</div>
          </div>
          <div
            class="device-pill"
            data-test-id="device-list-status"
            style="background:rgba(56,128,255,0.18);color:#6cb4ff;"
          >Hub</div>
        </div>
        <dl class="device-meta">
          <div>
            <dt>Type</dt>
            <dd>eLink Hub</dd>
          </div>
          <div>
            <dt>Battery</dt>
            <dd data-test-id="device-list-battery">${batteryText}</dd>
          </div>
        </dl>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
          <sl-button size="small" variant="default" data-test-id="hub-blink-button" @click=${this.onBlink}>Blink</sl-button>
          <sl-button size="small" variant="default" data-test-id="hub-calibrate-button" @click=${this.onCalibrate}>Calibrate</sl-button>
          <sl-button size="small" variant="default" data-test-id="hub-home-button" @click=${this.onHome}>Home</sl-button>
          <sl-button size="small" variant="default" data-test-id="hub-rename-button" @click=${this.onRenameOpen}>Rename</sl-button>
          <sl-button size="small" variant="default" data-test-id="hub-sleep-button" @click=${this.onSleep}>Sleep</sl-button>
        </div>
      </div>
    `;
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
      <div class="device-card" role="listitem" data-test-id="device-list-row">
        <div class="device-header">
          <div>
            <div class="device-name" data-test-id="device-list-name">
              ${name}
            </div>
            <div class="device-mac" data-test-id="device-list-mac">${mac}</div>
          </div>
          <div
            class="device-pill ${entry.isConnected ? "ok" : "warn"}"
            data-test-id="device-list-status"
          >
            ${entry.isConnected ? "Connected" : "Offline"}
          </div>
        </div>
        <dl class="device-meta">
          <div>
            <dt>Device ID</dt>
            <dd data-test-id="device-list-device-id">${deviceId}</dd>
          </div>
          <div>
            <dt>Battery</dt>
            <dd data-test-id="device-list-battery">${batteryText}</dd>
          </div>
          <div>
            <dt>RSSI</dt>
            <dd data-test-id="device-list-rssi">${rssi}</dd>
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

if (!customElements.get("page-device-list")) {
  customElements.define("page-device-list", PageDeviceList);
}

export { };
