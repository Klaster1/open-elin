import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { Router } from "@lit-labs/router";
import "@shoelace-style/shoelace/dist/themes/dark.css";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/alert/alert.js";
import "@shoelace-style/shoelace/dist/components/tag/tag.js";
import "@shoelace-style/shoelace/dist/components/spinner/spinner.js";
import "@shoelace-style/shoelace/dist/components/switch/switch.js";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";

import {
  appActions,
  appState,
  isValidMac,
  setShiftMacListener,
} from "./store.ts";
import { demoState } from "./demo-state.ts";
import { sharedStyles } from "./styles.ts";
import "./components/landing-page.ts";
import "./components/mac-page.ts";
import "./components/device-page.ts";

setBasePath("/node_modules/@shoelace-style/shoelace/dist/");
document.documentElement.classList.add("sl-theme-dark");

function serializeMacForRoute(value: string) {
  return value.trim().toUpperCase().replace(/:/g, "-");
}

function parseMacFromRoute(value: string) {
  return decodeURIComponent(value).replace(/-/g, ":").toUpperCase();
}

type RouteParams = {
  mac?: string;
  tab?: string;
};

class BikeNetApp extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
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
    `,
  ];

  private router = new Router(this, [
    { path: "/", render: () => this.renderLandingRoute() },
    { path: "/mac", render: () => this.renderMacRoute() },
    {
      path: "/device/:mac",
      enter: async ({ mac }) => {
        const normalizedMac = serializeMacForRoute(parseMacFromRoute(mac));
        await this.navigate(`/device/${normalizedMac}/log`, {
          replace: true,
        });
        return false;
      },
      render: () => html``,
    },
    {
      path: "/device/:mac/:tab",
      render: (params: RouteParams) =>
        this.renderDeviceRoute(params.mac, params.tab),
    },
  ]);

  connectedCallback() {
    super.connectedCallback();
    const storedMac = appActions.initStoredMac();
    if (storedMac && window.location.pathname.startsWith("/mac")) {
      this.navigate(`/device/${serializeMacForRoute(storedMac)}/log`);
    }
    setShiftMacListener((value) => {
      this.navigate(`/device/${serializeMacForRoute(value)}/log`);
    });
  }

  disconnectedCallback() {
    setShiftMacListener(null);
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
        ${this.router.outlet()}
      </div>
    `;
  }

  private renderLandingRoute() {
    return html`<landing-page
      @connect-requested=${this.handleConnect}
      @demo-requested=${this.handleDemo}
    ></landing-page>`;
  }

  private renderMacRoute() {
    return html`<mac-page></mac-page>`;
  }

  private renderDeviceRoute(macParam?: string, tabParam?: string) {
    const currentMac = appState.mac.get();
    const routeMac = macParam;

    if (routeMac) {
      const parsedMac = parseMacFromRoute(routeMac);
      const normalized = parsedMac.toUpperCase();
      const demoHubMac = demoState.state.get().device.mac.toUpperCase();
      if (
        normalized === demoHubMac &&
        !appState.demoMode.get() &&
        !appState.connected.get()
      ) {
        queueMicrotask(() => appActions.connectDemo());
      }
      if (isValidMac(normalized) && normalized !== currentMac) {
        queueMicrotask(() => appActions.setPendingRouteMac(parsedMac));
        queueMicrotask(() => appActions.setMacFromRoute(parsedMac));
      }
    }

    const targetMac =
      currentMac || (routeMac ? parseMacFromRoute(routeMac) : "");
    const activeTab = tabParam || "log";

    return html`
      <device-page
        .macValue=${targetMac}
        .activeTab=${activeTab}
        @reconnect-requested=${this.handleReconnect}
        @demo-requested=${this.handleDemo}
      ></device-page>
    `;
  }

  private async handleConnect() {
    await appActions.connect();
    const mac = appState.mac.get();
    if (mac) {
      void this.navigate(`/device/${serializeMacForRoute(mac)}/log`);
    } else {
      void this.navigate("/mac");
    }
  }

  private async handleReconnect() {
    await appActions.connect();
    const mac = appState.mac.get();
    if (mac) {
      const pending = appState.pendingRouteMac.get();
      const target = pending || mac;
      void this.navigate(`/device/${serializeMacForRoute(target)}/log`);
    }
  }

  private async handleDemo() {
    await appActions.connectDemo();
    const mac = appState.mac.get();
    if (mac) {
      void this.navigate(`/device/${serializeMacForRoute(mac)}/log`);
    }
  }

  private async navigate(path: string, options: { replace?: boolean } = {}) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (options.replace) {
      window.history.replaceState({}, "", normalized);
    } else {
      window.history.pushState({}, "", normalized);
    }
    await this.router.goto(normalized);
  }
}

customElements.define(
  "bikenet-app",
  BikeNetApp as unknown as CustomElementConstructor,
);

export {};
