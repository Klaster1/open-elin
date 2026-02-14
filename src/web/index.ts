import { LitElement, css, html } from "https://esm.sh/lit@3.2.1";
import { Routes } from "https://esm.sh/@lit-labs/router@0.1.0";
import "https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/components/button/button.js";
import "https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/components/card/card.js";
import "https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/components/input/input.js";
import "https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/components/alert/alert.js";
import "https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/components/tag/tag.js";
import { setBasePath } from "https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/utilities/base-path.js";

import { BikeNetCommands } from "../commands.ts";
import { BikeNetProtocol } from "../protocol.ts";
import type { TransportDevice } from "../protocol.ts";
import { WebBluetoothTransport } from "./transport-web.ts";

setBasePath("https://esm.sh/@shoelace-style/shoelace@2.14.0/dist/");
document.documentElement.classList.add("sl-theme-dark");

type StatusKind = "wait" | "warn" | "ok";

type RouteParams = {
  mac?: string;
};

class BikeNetApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--text, #e7edf5);
      font-family: var(--sans, "Space Grotesk", sans-serif);
    }

    .app {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 28px 60px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .hero {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
    }

    h1 {
      font-size: 32px;
      margin: 0;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 18px;
      margin: 0;
    }

    .subtitle {
      color: var(--muted, #98a6b5);
      margin: 8px 0 0;
      font-size: 14px;
    }

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

    .hint {
      color: var(--muted, #98a6b5);
      font-size: 13px;
      margin: 0;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    sl-button::part(base) {
      border-radius: 10px;
      font-weight: 600;
    }

    sl-input::part(base) {
      border-radius: 10px;
      border-color: #2b3b4c;
      background: #0e141b;
      color: inherit;
    }

    .pane-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .pane {
      background: var(--panel-strong, #1a2430);
      border-radius: 14px;
      padding: 16px;
      border: 1px solid #2b3a4b;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 200px;
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

    .status.wait {
      background: rgba(88, 110, 134, 0.2);
      color: #c0cad6;
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

    .empty-state.stack {
      margin-top: 0;
      padding: 28px;
      min-height: 280px;
      flex-direction: column;
      text-align: center;
      gap: 14px;
      border-style: solid;
      border-color: #2b3a4b;
      background: rgba(10, 16, 22, 0.8);
    }

    .empty-icon {
      width: 120px;
      height: 120px;
      border-radius: 28px;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 30% 30%, #2d3c4c, #121a24);
      border: 1px solid #2b3a4b;
    }

    .empty-icon svg {
      width: 72px;
      height: 72px;
      opacity: 0.9;
    }

    .empty-title {
      margin: 0;
      font-size: 20px;
      color: var(--text, #e7edf5);
    }

    .empty-message {
      margin: 0;
      max-width: 420px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .log {
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      max-height: 60vh;
      overflow: auto;
      font-family: var(--mono, "JetBrains Mono", monospace);
    }

    .route-chip {
      margin-left: auto;
    }

    @media (max-width: 900px) {
      .pane-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  static properties = {
    connected: { state: true },
    connectEmpty: { state: true },
    mac: { state: true },
    manualMac: { state: true },
    adStatusText: { state: true },
    adStatusKind: { state: true },
    shiftStatusText: { state: true },
    shiftStatusKind: { state: true },
    logLines: { state: true },
  };

  private connected = false;
  private connectEmpty = false;
  private mac = "";
  private manualMac = "";
  private adStatusText = "Listening for advertisements...";
  private adStatusKind: StatusKind = "wait";
  private shiftStatusText = "Waiting for a shift-complete notification...";
  private shiftStatusKind: StatusKind = "wait";
  private logLines: string[] = [];
  private pendingRouteMac = "";

  private commands: BikeNetCommands | null = null;
  private connectedDevice: TransportDevice | null = null;
  private pendingAdvertMac: string | null = null;
  private adTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private macLockedByUser = false;
  private readonly macStorageKey = "bikenetHubMac";

  private routes = new Routes(this, [
    { path: "/", render: () => this.renderLanding() },
    { path: "/mac", render: () => this.renderMac() },
    {
      path: "/device/:mac",
      render: (data: { params: RouteParams }) =>
        this.renderDevice(data.params?.mac),
    },
  ]);

  private onHashChange = () => {
    const path = this.getHashPath();
    void this.routes.goto(path);
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("hashchange", this.onHashChange);
    if (!window.location.hash.startsWith("#!/")) {
      window.location.hash = "#!/";
    }
    this.onHashChange();
    const storedMac = this.readStoredMac();
    if (storedMac && this.isValidMac(storedMac) && !this.mac) {
      this.setMac(storedMac, "stored");
    }
    if (storedMac && this.isMacRoute()) {
      this.navigate(`/device/${encodeURIComponent(storedMac)}`);
    }
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.onHashChange);
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="app">
        <header class="hero">
          <div>
            <h1>BikeNet Web Bluetooth</h1>
            <p class="subtitle">
              Multi-step connect flow to discover the hub MAC and unlock
              actions.
            </p>
          </div>
          ${this.mac
            ? html`<sl-tag class="route-chip" variant="success"
                >${this.mac}</sl-tag
              >`
            : null}
        </header>
        ${this.routes.outlet()}
      </div>
    `;
  }

  private renderLanding() {
    return html`
      <section>
        <div class="card">
          <div class="card-head">
            <h2>1. Connection</h2>
            <p class="hint">
              Click Connect to pick the eLink hub from the Web Bluetooth picker.
            </p>
          </div>
          <div class="row">
            <sl-button variant="primary" @click=${this.handleConnect}
              >Connect</sl-button
            >
          </div>
          ${this.connectEmpty
            ? html`<div class="empty-state">
                No hub was selected. If the picker did not appear, make sure Web
                Bluetooth is enabled and try again.
              </div>`
            : null}
        </div>
      </section>
    `;
  }

  private renderMac() {
    return html`
      <section>
        <div class="card">
          <div class="card-head">
            <h2>2. MAC acquisition</h2>
            <p class="hint">
              We need the hub MAC to send commands. Use one of the methods
              below.
            </p>
          </div>
          <div class="pane-grid">
            <div class="pane">
              <h2>Auto discover (ads)</h2>
              <p class="hint">
                We listen for manufacturer data in advertisements.
              </p>
              <div class="status ${this.adStatusKind}">
                ${this.adStatusText}
              </div>
              <p class="hint">Keep the hub awake and nearby.</p>
            </div>
            <div class="pane">
              <h2>Shift a gear</h2>
              <p class="hint">
                Shift once so we receive a Shift Complete event with the MAC.
              </p>
              <div class="status ${this.shiftStatusKind}">
                ${this.shiftStatusText}
              </div>
              <p class="hint">A single shift up or down is enough.</p>
            </div>
            <div class="pane">
              <h2>Manual entry</h2>
              <sl-input
                placeholder="AA:BB:CC:DD:EE:FF"
                value=${this.manualMac}
                @sl-input=${this.onManualInput}
              ></sl-input>
              <div class="row">
                <sl-button variant="default" @click=${this.applyManualMac}
                  >Use this MAC</sl-button
                >
              </div>
              <p class="hint">
                Find the MAC with nRF Connect or any Bluetooth scanner app.
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private renderDevice(macParam?: string) {
    if (macParam) {
      const decoded = decodeURIComponent(macParam);
      if (this.isValidMac(decoded) && decoded !== this.mac) {
        queueMicrotask(() => this.setMac(decoded, "route"));
        this.pendingRouteMac = decoded;
      }
    }

    const canSend = this.connected && Boolean(this.mac);
    const canList = this.connected;

    if (!this.connected) {
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
            <sl-button variant="primary" @click=${this.handleReconnect}
              >Connect to hub</sl-button
            >
          </div>
        </section>
      `;
    }

    return html`
      <section>
        <div class="card">
          <div class="card-head">
            <h2>3. Actions</h2>
            <p class="hint">
              MAC locked in. You can query and control the hub.
            </p>
          </div>
          <div class="actions">
            <sl-button ?disabled=${!canList} @click=${this.getList}
              >Get list</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.getMotorParams}
              >Get motor params</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.getPosition}
              >Get position</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.shiftUp}
              >Shift up</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.shiftDown}
              >Shift down</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.readButtonMap}
              >Read button map</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.readButtonTable}
              >Read button table</sl-button
            >
            <sl-button ?disabled=${!canSend} @click=${this.getRearCogInfo}
              >Get rear cog info</sl-button
            >
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <h2>Log</h2>
            <p class="hint">Notifications and command results appear here.</p>
          </div>
          <pre class="log">${this.logLines.join("\n")}</pre>
        </div>
      </section>
    `;
  }

  private onManualInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.manualMac = target.value.trim().toUpperCase();
  }

  private applyManualMac() {
    if (!this.manualMac) {
      this.appendLog("Enter a hub MAC to continue.");
      return;
    }
    if (!this.isValidMac(this.manualMac)) {
      this.appendLog("Enter a valid hub MAC (AA:BB:CC:DD:EE:FF).");
      return;
    }
    this.macLockedByUser = true;
    this.setMac(this.manualMac, "manual entry");
  }

  private async handleConnect() {
    this.connectEmpty = false;
    this.connected = false;
    this.appendLog("Requesting device...");

    const transport = new WebBluetoothTransport({
      deviceNamePrefix: "",
      onAdvertisementMac: (mac) => {
        this.pendingAdvertMac = mac;
        if (!this.connectedDevice) return;
        this.setMac(mac, "advertisements");
      },
    });
    const protocol = new BikeNetProtocol(transport);

    try {
      const devices = await protocol.listDevices();
      if (!devices.length) {
        this.connectEmpty = true;
        this.appendLog("No devices found.");
        return;
      }

      const device = devices[0];
      this.connectedDevice = device;
      const storedMac = this.readStoredMac();
      const macFromAdvert = device.address;
      const macToUse = storedMac || macFromAdvert;

      if (macToUse) {
        this.setMac(macToUse, storedMac ? "stored" : "advertisements");
      } else {
        this.resetMacStatus();
        this.startAdTimer();
      }

      device.address = this.mac || "";
      this.appendLog("Selected device:", {
        id: device.id,
        name: device.name,
        mac: device.address || "(none)",
      });

      const deviceCommands = new BikeNetCommands(protocol, device);
      this.commands = deviceCommands;
      this.connected = true;

      if (this.mac) {
        this.navigate(`/device/${encodeURIComponent(this.mac)}`);
      } else {
        this.navigate("/mac");
        if (this.pendingAdvertMac) {
          this.setMac(this.pendingAdvertMac, "advertisements");
          this.pendingAdvertMac = null;
        }
      }

      await this.subscribeNotifications(deviceCommands);
      this.appendLog("Connected. Use the actions to query the hub.");
    } catch (err) {
      this.connectEmpty = true;
      this.appendLog("No device was selected.");
      console.error(err);
    }
  }

  private async handleReconnect() {
    await this.handleConnect();
    if (this.mac) {
      const target = this.pendingRouteMac || this.mac;
      this.navigate(`/device/${encodeURIComponent(target)}`);
    }
  }

  private async subscribeNotifications(deviceCommands: BikeNetCommands) {
    await deviceCommands.subscribeToBatteryVoltage((battery) => {
      if (battery.status !== "success") return;
      this.appendLog("Battery notification", {
        targetMac: battery.targetMac,
        batteryVoltage: battery.batteryVoltage,
        rawHex: battery.rawHex,
      });
    });

    await deviceCommands.subscribeToButtonAction((action) => {
      if (action.status !== "success") return;
      this.appendLog("Button action", {
        targetMac: action.targetMac,
        buttonId: action.buttonId,
        buttonLabel: action.buttonLabel,
        actionLabel: action.actionLabel,
        rawHex: action.rawHex,
      });
    });

    await deviceCommands.subscribeToShiftComplete((shift) => {
      if (shift.status !== "success") return;
      this.appendLog("Shift complete", {
        targetMac: shift.targetMac,
        payloadValue: shift.payloadValue,
        rawHex: shift.rawHex,
      });
      if (!this.mac && shift.targetMac) {
        this.setMac(shift.targetMac, "shift-complete");
        this.navigate(`/device/${encodeURIComponent(this.mac)}`);
      }
    });

    await deviceCommands.subscribeToButtonTable((table) => {
      if (table.status !== "success") return;
      this.appendLog("Button table", {
        targetMac: table.targetMac,
        entries: table.entries ?? [],
      });
    });

    await deviceCommands.subscribeToFrontCog((frontCog) => {
      if (frontCog.status !== "success") return;
      this.appendLog("Front cog", {
        targetMac: frontCog.targetMac,
        rawHex: frontCog.rawHex,
      });
    });
  }

  private setMac(value: string, source: string) {
    const normalized = value.trim().toUpperCase();
    if (!this.isValidMac(normalized)) return false;
    if (this.macLockedByUser && source !== "manual entry") return false;

    this.mac = normalized;
    this.storeMac(normalized);
    if (this.connectedDevice) {
      this.connectedDevice.address = normalized;
    }

    this.appendLog(`Hub MAC set from ${source}:`, normalized);
    if (source === "advertisements") {
      this.adStatusKind = "ok";
      this.adStatusText = "MAC discovered from advertisements.";
    }
    if (source === "shift-complete") {
      this.shiftStatusKind = "ok";
      this.shiftStatusText = "MAC captured from shift complete.";
    }
    if (source === "manual entry") {
      this.adStatusKind = "warn";
      this.adStatusText = "Manual MAC entry used.";
    }
    if (source === "stored") {
      this.adStatusKind = "ok";
      this.adStatusText = "MAC loaded from local storage.";
    }
    if (this.adTimeoutId) {
      clearTimeout(this.adTimeoutId);
      this.adTimeoutId = null;
    }
    return true;
  }

  private resetMacStatus() {
    this.adStatusKind = "wait";
    this.adStatusText = "Listening for advertisements...";
    this.shiftStatusKind = "wait";
    this.shiftStatusText = "Waiting for a shift-complete notification...";
  }

  private startAdTimer() {
    if (this.adTimeoutId) {
      clearTimeout(this.adTimeoutId);
      this.adTimeoutId = null;
    }
    this.adTimeoutId = setTimeout(() => {
      if (!this.mac) {
        this.adStatusKind = "warn";
        this.adStatusText = "Couldn't discover MAC from advertisements yet.";
      }
    }, 10000);
  }

  private readStoredMac() {
    try {
      const value = localStorage.getItem(this.macStorageKey);
      return value ? value.trim().toUpperCase() : "";
    } catch {
      return "";
    }
  }

  private storeMac(mac: string) {
    try {
      localStorage.setItem(this.macStorageKey, mac);
    } catch {
      // Ignore storage failures.
    }
  }

  private appendLog(...parts: Array<string | number | object>) {
    const line = parts
      .map((p) => (typeof p === "string" ? p : JSON.stringify(p, null, 2)))
      .join(" ");
    const next = [...this.logLines, line];
    this.logLines = next.slice(-400);
  }

  private isValidMac(value: string) {
    return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(value);
  }

  private navigate(path: string) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const hash = `#!${normalized}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      void this.routes.goto(normalized);
    }
  }

  private getHashPath() {
    const hash = window.location.hash;
    if (hash.startsWith("#!/")) return hash.slice(2) || "/";
    if (hash.startsWith("#")) return hash.slice(1) || "/";
    return "/";
  }

  private isMacRoute() {
    return window.location.hash.startsWith("#!/mac");
  }

  private isDeviceRoute() {
    return window.location.hash.startsWith("#!/device/");
  }

  private async getList() {
    if (!this.commands) {
      this.appendLog("Connect to a hub first.");
      return;
    }
    this.appendLog("Get list...");
    try {
      const response = await this.commands.getList();
      if (response.status === "success" && response.entries?.length) {
        response.entries.forEach((entry, index) =>
          this.appendLog({ index, ...entry }),
        );
      }
      this.appendLog("Get list result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Get list error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async getMotorParams() {
    if (!this.commands) return;
    this.appendLog("Get motor params...");
    try {
      const response = await this.commands.getMotorParams();
      if (response.status === "success") {
        this.appendLog("Motor params", response.humanReadable ?? {});
      }
      this.appendLog("Get motor params result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Get motor params error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async getPosition() {
    if (!this.commands) return;
    this.appendLog("Get position...");
    try {
      const response = await this.commands.getPosition();
      if (response.status === "success") {
        this.appendLog("Position", {
          absolutePosition: response.absolutePosition,
          gearPosition: response.gearPosition,
        });
      }
      this.appendLog("Get position result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Get position error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async shiftUp() {
    if (!this.commands) return;
    this.appendLog("Shift up...");
    try {
      const response = await this.commands.shiftUp();
      this.appendLog("Shift up result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Shift up error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async shiftDown() {
    if (!this.commands) return;
    this.appendLog("Shift down...");
    try {
      const response = await this.commands.shiftDown();
      this.appendLog("Shift down result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Shift down error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async readButtonMap() {
    if (!this.commands) return;
    this.appendLog("Read button map...");
    try {
      const response = await this.commands.readButtonMap();
      this.appendLog("Read button map result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Read button map error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async readButtonTable() {
    if (!this.commands) return;
    this.appendLog("Read button table...");
    try {
      const response = await this.commands.readButtonTable();
      this.appendLog("Read button table result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Read button table error",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async getRearCogInfo() {
    if (!this.commands) return;
    this.appendLog("Get rear cog info...");
    try {
      const response = await this.commands.getRearCogInfo();
      this.appendLog("Get rear cog info result", response ?? {});
    } catch (err) {
      this.appendLog(
        "Get rear cog info error",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

customElements.define("bikenet-app", BikeNetApp);

export {};
