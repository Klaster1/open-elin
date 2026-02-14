import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { Routes } from "@lit-labs/router";
import "@shoelace-style/shoelace/dist/themes/dark.css";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/alert/alert.js";
import "@shoelace-style/shoelace/dist/components/tag/tag.js";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";

import {
  appActions,
  appState,
  isValidMac,
  setShiftMacListener,
} from "./store.ts";

setBasePath("/node_modules/@shoelace-style/shoelace/dist/");
document.documentElement.classList.add("sl-theme-dark");

type RouteParams = {
  mac?: string;
  tab?: string;
};

const deviceTabs = [
  { id: "list", label: "Device list" },
  { id: "motor", label: "Motor params" },
  { id: "buttons", label: "Buttons" },
  { id: "cogs", label: "Cogs" },
  { id: "log", label: "Log" },
];

class BikeNetApp extends SignalWatcher(LitElement) {
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

    .sidebar-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted, #98a6b5);
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

      .shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
      }
    }
  `;

  private routes = new Routes(this, [
    { path: "/", render: () => this.renderLanding() },
    { path: "/mac", render: () => this.renderMac() },
    {
      path: "/device/:mac/:tab",
      render: (data: { params: RouteParams }) =>
        this.renderDevice(data.params?.mac, data.params?.tab),
    },
  ]);

  private onHashChange = () => {
    const path = this.getHashPath();
    const normalized = this.normalizeRoute(path);
    if (normalized && normalized !== path) {
      const hash = `#!${normalized}`;
      if (window.location.hash !== hash) {
        window.location.hash = hash;
      }
      return;
    }
    void this.routes.goto(path);
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("hashchange", this.onHashChange);
    if (!window.location.hash.startsWith("#!/")) {
      window.location.hash = "#!/";
    }
    this.onHashChange();
    const storedMac = appActions.initStoredMac();
    if (storedMac && this.isMacRoute()) {
      this.navigate(`/device/${encodeURIComponent(storedMac)}/log`);
    }
    setShiftMacListener((value) => {
      this.navigate(`/device/${encodeURIComponent(value)}/log`);
    });
  }

  disconnectedCallback() {
    setShiftMacListener(null);
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
        </header>
        ${this.routes.outlet()}
      </div>
    `;
  }

  private renderLanding() {
    const connectEmpty = appState.connectEmpty.get();
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
          ${connectEmpty
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
    const manualMac = appState.manualMac.get();
    const adStatusKind = appState.adStatusKind.get();
    const adStatusText = appState.adStatusText.get();
    const shiftStatusKind = appState.shiftStatusKind.get();
    const shiftStatusText = appState.shiftStatusText.get();
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
              <div class="status ${adStatusKind}">${adStatusText}</div>
              <p class="hint">Keep the hub awake and nearby.</p>
            </div>
            <div class="pane">
              <h2>Shift a gear</h2>
              <p class="hint">
                Shift once so we receive a Shift Complete event with the MAC.
              </p>
              <div class="status ${shiftStatusKind}">${shiftStatusText}</div>
              <p class="hint">A single shift up or down is enough.</p>
            </div>
            <div class="pane">
              <h2>Manual entry</h2>
              <sl-input
                placeholder="AA:BB:CC:DD:EE:FF"
                value=${manualMac}
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

  private renderDevice(macParam?: string, tabParam?: string) {
    const currentMac = appState.mac.get();
    const routeInfo = this.parseDeviceRoute();
    const routeMac = routeInfo?.mac || macParam;
    const routeTab = routeInfo?.tab || tabParam;

    if (routeMac) {
      const decoded = decodeURIComponent(routeMac);
      if (isValidMac(decoded) && decoded !== currentMac) {
        queueMicrotask(() => appActions.setPendingRouteMac(decoded));
        queueMicrotask(() => appActions.setMacFromRoute(decoded));
      }
    }

    const connected = appState.connected.get();
    const targetMac =
      currentMac || (routeMac ? decodeURIComponent(routeMac) : "");
    const activeTab = this.normalizeTab(routeTab);

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
            <sl-button variant="primary" @click=${this.handleReconnect}
              >Connect to hub</sl-button
            >
          </div>
        </section>
      `;
    }

    return html`
      <section class="shell">
        <aside class="card sidebar">
          <div class="sidebar-head">
            <div class="sidebar-title">Active hub</div>
            <div class="sidebar-mac">${targetMac || "Unknown"}</div>
            <div class="status ok">Connected</div>
          </div>
          <nav class="nav-list">
            ${deviceTabs.map((tab) =>
              this.renderNavLink(tab.id, tab.label, activeTab, targetMac),
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
        return this.renderListTab();
      case "motor":
        return this.renderMotorTab();
      case "buttons":
        return this.renderButtonsTab();
      case "cogs":
        return this.renderCogsTab();
      case "log":
      default:
        return this.renderLogTab();
    }
  }

  private renderListTab() {
    const canList = appState.connected.get();
    const entries = appState.listEntries.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Device list</h2>
          <p class="hint">Scan the hub for linked devices.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canList} @click=${this.getList}
            >Get list</sl-button
          >
        </div>
        ${entries.length
          ? html`<pre class="log">
${entries
                .map((entry, index) => `${index + 1}. ${JSON.stringify(entry)}`)
                .join("\n")}</pre
            >`
          : html`<div class="empty-state">No device list loaded yet.</div>`}
      </div>
    `;
  }

  private renderMotorTab() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const motorParams = appState.motorParams.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Motor params</h2>
          <p class="hint">Latest motor configuration snapshot.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.getMotorParams}
            >Get motor params</sl-button
          >
        </div>
        ${motorParams
          ? html`<pre class="log">${JSON.stringify(motorParams, null, 2)}</pre>`
          : html`<div class="empty-state">No motor params fetched yet.</div>`}
      </div>
    `;
  }

  private renderButtonsTab() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const buttonMap = appState.buttonMap.get();
    const buttonTable = appState.buttonTable.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Buttons</h2>
          <p class="hint">Read the button map and table from the hub.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.readButtonMap}
            >Read button map</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.readButtonTable}
            >Read button table</sl-button
          >
        </div>
        ${buttonMap
          ? html`<pre class="log">${JSON.stringify(buttonMap, null, 2)}</pre>`
          : html`<div class="empty-state">No button map loaded yet.</div>`}
        ${buttonTable
          ? html`<pre class="log">${JSON.stringify(buttonTable, null, 2)}</pre>`
          : html`<div class="empty-state">No button table loaded yet.</div>`}
      </div>
    `;
  }

  private renderCogsTab() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const rearCogInfo = appState.rearCogInfo.get();
    const position = appState.position.get();
    const frontCog = appState.frontCogInfo.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Cogs</h2>
          <p class="hint">Rear cog diagnostics and live position snapshots.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.getRearCogInfo}
            >Get rear cog info</sl-button
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
        </div>
        ${rearCogInfo
          ? html`<pre class="log">${JSON.stringify(rearCogInfo, null, 2)}</pre>`
          : html`<div class="empty-state">No rear cog info yet.</div>`}
        ${position
          ? html`<pre class="log">${JSON.stringify(position, null, 2)}</pre>`
          : html`<div class="empty-state">No position read yet.</div>`}
        ${frontCog
          ? html`<pre class="log">${JSON.stringify(frontCog, null, 2)}</pre>`
          : html`<div class="empty-state">No front cog notification yet.</div>`}
      </div>
    `;
  }

  private renderLogTab() {
    const logLines = appState.logLines.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Log</h2>
          <p class="hint">Notifications and command results appear here.</p>
        </div>
        <pre class="log">${logLines.join("\n")}</pre>
      </div>
    `;
  }

  private onManualInput(event: Event) {
    const target = event.target as HTMLInputElement;
    appActions.setManualMac(target.value);
  }

  private applyManualMac() {
    appActions.applyManualMac();
  }

  private async handleConnect() {
    await appActions.connect();
    const mac = appState.mac.get();
    if (mac) {
      this.navigate(`/device/${encodeURIComponent(mac)}/log`);
    } else {
      this.navigate("/mac");
    }
  }

  private async handleReconnect() {
    await appActions.connect();
    const mac = appState.mac.get();
    if (mac) {
      const pending = appState.pendingRouteMac.get();
      const target = pending || mac;
      this.navigate(`/device/${encodeURIComponent(target)}/log`);
    }
  }

  private normalizeTab(tab?: string) {
    if (!tab) return "log";
    const match = deviceTabs.find((item) => item.id === tab);
    return match ? match.id : "log";
  }

  private normalizeRoute(path: string) {
    const baseMatch = path.match(/^\/device\/([^/]+)$/);
    if (baseMatch) {
      return `/device/${baseMatch[1]}/log`;
    }
    const tabMatch = path.match(/^\/device\/([^/]+)\/([^/]+)$/);
    if (tabMatch) {
      const tab = this.normalizeTab(tabMatch[2]);
      if (tab !== tabMatch[2]) {
        return `/device/${tabMatch[1]}/${tab}`;
      }
    }
    return null;
  }

  private parseDeviceRoute() {
    const path = this.getHashPath();
    const match = path.match(/^\/device\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    return { mac: match[1], tab: match[2] };
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
    await appActions.getList();
  }

  private async getMotorParams() {
    await appActions.getMotorParams();
  }

  private async getPosition() {
    await appActions.getPosition();
  }

  private async shiftUp() {
    await appActions.shiftUp();
  }

  private async shiftDown() {
    await appActions.shiftDown();
  }

  private async readButtonMap() {
    await appActions.readButtonMap();
  }

  private async readButtonTable() {
    await appActions.readButtonTable();
  }

  private async getRearCogInfo() {
    await appActions.getRearCogInfo();
  }
}

customElements.define(
  "bikenet-app",
  BikeNetApp as unknown as CustomElementConstructor,
);

export {};
