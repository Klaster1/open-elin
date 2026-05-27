import { Router } from "@lit-labs/router";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";

import hubData from "../demo/hub-mock-data.json";
import "./console-panel.ts";
import {
    appActions,
    appState,
    consoleHeight,
    consoleOpen,
    isValidMac,
    setConsoleHeight,
    setShiftMacListener,
    toggleConsole,
} from "../store.ts";
import { sharedStyles } from "../styles.ts";

function serializeMacForRoute(value: string) {
  return value.trim().toUpperCase().replace(/:/g, "-");
}

function parseMacFromRoute(value: string) {
  return decodeURIComponent(value).replace(/-/g, ":").toUpperCase();
}

type RouteParams = {
  mac?: string;
  page?: string;
};

export class App extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
      }

      .app-scroll {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      .app {
        max-width: 1600px;
        margin: 0 auto;
        padding: 40px 28px 20px;
        display: flex;
        flex-direction: column;
        gap: 22px;
        min-height: 0;
      }

      .hero {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
      }

      .console-pane {
        flex-shrink: 0;
        border-top: 1px solid var(--panel-border, #223142);
        background: var(--panel, #141c24);
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .console-drag-handle {
        position: absolute;
        top: -4px;
        left: 0;
        right: 0;
        height: 8px;
        cursor: ns-resize;
        z-index: 10;
      }

      .console-drag-handle:hover,
      .console-drag-handle.dragging {
        background: var(--accent, #35c28b);
        opacity: 0.5;
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
        await this.navigate(`/device/${normalizedMac}/list`, {
          replace: true,
        });
        return false;
      },
      render: () => html``,
    },
    {
      path: "/device/:mac/:page",
      render: (params: RouteParams) =>
        this.renderDeviceRoute(params.mac, params.page),
    },
  ]);

  connectedCallback() {
    super.connectedCallback();
    const storedMac = appActions.initStoredMac();
    if (storedMac && window.location.pathname.startsWith("/mac")) {
      this.navigate(`/device/${serializeMacForRoute(storedMac)}/list`);
    }
    setShiftMacListener((value) => {
      this.navigate(`/device/${serializeMacForRoute(value)}/list`);
    });
  }

  disconnectedCallback() {
    setShiftMacListener(null);
    super.disconnectedCallback();
  }

  render() {
    const connected = appState.connected.get();
    const isConsoleOpen = consoleOpen.get();
    const paneHeight = consoleHeight.get();
    return html`
      <div class="app-scroll">
        <div class="app">
          <header class="hero">
            <div>
              <h1>OpenElin</h1>
            </div>
          </header>
          ${this.router.outlet()}
        </div>
      </div>
      ${connected && isConsoleOpen
        ? html`<div class="console-pane" style="height:${paneHeight}px">
            <div
              class="console-drag-handle"
              @pointerdown=${this.onDragStart}
            ></div>
            <console-panel></console-panel>
          </div>`
        : html``}
    `;
  }

  private dragging = false;
  private dragStartY = 0;
  private dragStartHeight = 0;

  private onDragStart = (e: PointerEvent) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    this.dragging = true;
    this.dragStartY = e.clientY;
    this.dragStartHeight = consoleHeight.get();
    handle.addEventListener("pointermove", this.onDragMove);
    handle.addEventListener("pointerup", this.onDragEnd);
    handle.addEventListener("pointercancel", this.onDragEnd);
  };

  private onDragMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const delta = this.dragStartY - e.clientY;
    setConsoleHeight(this.dragStartHeight + delta);
  };

  private onDragEnd = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    const handle = e.currentTarget as HTMLElement;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove("dragging");
    handle.removeEventListener("pointermove", this.onDragMove);
    handle.removeEventListener("pointerup", this.onDragEnd);
    handle.removeEventListener("pointercancel", this.onDragEnd);
  };

  private renderLandingRoute() {
    return html`<page-landing
      @connect-requested=${this.handleConnect}
      @demo-requested=${this.handleDemo}
    ></page-landing>`;
  }

  private renderMacRoute() {
    return html`<page-mac @mac-acquired=${this.handleMacAcquired}></page-mac>`;
  }

  private renderDeviceRoute(macParam?: string, pageParam?: string) {
    const currentMac = appState.mac.get();
    const routeMac = macParam;

    if (routeMac) {
      const parsedMac = parseMacFromRoute(routeMac);
      const normalized = parsedMac.toUpperCase();
      const demoHubMac = hubData.device.mac.toUpperCase();
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
    const activePage = pageParam || "list";

    return html`
      <shell-device
        .macValue=${targetMac}
        .activePage=${activePage}
        @reconnect-requested=${this.handleReconnect}
        @disconnect-requested=${this.handleDisconnect}
        @sleep-requested=${this.handleSleep}
        @demo-requested=${this.handleDemo}
      ></shell-device>
    `;
  }

  private async handleConnect() {
    await appActions.connect();
    const mac = appState.mac.get();
    if (mac) {
      void this.navigate(`/device/${serializeMacForRoute(mac)}/list`);
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
      void this.navigate(`/device/${serializeMacForRoute(target)}/list`);
    }
  }

  private async handleDemo(event: CustomEvent<{ full?: boolean }> | Event) {
    const detail = "detail" in event ? event.detail : undefined;
    const full = Boolean(detail?.full);
    await appActions.connectDemo({ full });
    const mac = appState.mac.get();
    if (mac) {
      void this.navigate(`/device/${serializeMacForRoute(mac)}/list`);
    } else if (full) {
      void this.navigate("/mac");
    }
  }

  private handleMacAcquired() {
    const mac = appState.mac.get();
    if (mac) {
      void this.navigate(`/device/${serializeMacForRoute(mac)}/list`);
    }
  }

  private async handleDisconnect() {
    appActions.clearStoredMac();
    await this.navigate("/");
  }

  private async handleSleep() {
    await appActions.powerDown();
    appActions.clearStoredMac();
    await this.navigate("/");
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

if (!customElements.get("openelin-app")) {
  customElements.define(
    "openelin-app",
    App as unknown as CustomElementConstructor,
  );
}

export { };
