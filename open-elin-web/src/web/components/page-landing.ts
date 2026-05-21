import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./connection-empty-state.ts";

export class PageLanding extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const connected = appState.connected.get();
    if (connected) {
      return html``;
    }
    return html`
      <connection-empty-state
        @connect-action=${this.onConnect}
        @demo-action=${this.onDemo}
      ></connection-empty-state>
    `;
  }

  private onConnect() {
    this.dispatchEvent(
      new CustomEvent("connect-requested", { bubbles: true, composed: true }),
    );
  }

  private onDemo(event: CustomEvent<{ altKey?: boolean }>) {
    this.dispatchEvent(
      new CustomEvent("demo-requested", {
        bubbles: true,
        composed: true,
        detail: { full: Boolean(event.detail?.altKey) },
      }),
    );
  }
}

if (!customElements.get("page-landing")) {
  customElements.define("page-landing", PageLanding);
}

export {};
