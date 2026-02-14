import { LitElement, html } from "lit";
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
import { deviceTabs } from "./device-tabs.ts";
import { sharedStyles } from "./styles.ts";
import "./components/landing-page.ts";
import "./components/mac-page.ts";
import "./components/device-page.ts";

setBasePath("/node_modules/@shoelace-style/shoelace/dist/");
document.documentElement.classList.add("sl-theme-dark");

type RouteParams = {
  mac?: string;
  tab?: string;
};

class BikeNetApp extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  private routes = new Routes(this, [
    { path: "/", render: () => this.renderLandingRoute() },
    { path: "/mac", render: () => this.renderMacRoute() },
    {
      path: "/device/:mac/:tab",
      render: (data: { params: RouteParams }) =>
        this.renderDeviceRoute(data.params?.mac, data.params?.tab),
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
          </div>
        </header>
        ${this.routes.outlet()}
      </div>
    `;
  }

  private renderLandingRoute() {
    return html`<landing-page
      @connect-requested=${this.handleConnect}
    ></landing-page>`;
  }

  private renderMacRoute() {
    return html`<mac-page></mac-page>`;
  }

  private renderDeviceRoute(macParam?: string, tabParam?: string) {
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

    const targetMac =
      currentMac || (routeMac ? decodeURIComponent(routeMac) : "");
    const activeTab = this.normalizeTab(routeTab);

    return html`
      <device-page
        .macValue=${targetMac}
        .activeTab=${activeTab}
        @reconnect-requested=${this.handleReconnect}
      ></device-page>
    `;
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
}

customElements.define(
  "bikenet-app",
  BikeNetApp as unknown as CustomElementConstructor,
);

export {};
