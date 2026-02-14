import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./empty-state.ts";

class LandingPage extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const connectEmpty = appState.connectEmpty.get();
    const connected = appState.connected.get();
    if (connected) {
      return html``;
    }
    const emptyTitle = connectEmpty ? "No hub selected" : "Ready to connect";
    const emptyMessage = connectEmpty
      ? "No hub was selected. If the picker did not appear, make sure Web Bluetooth is enabled and try again."
      : "No hub connected yet. Click Connect to choose an eLink hub.";
    return html`
      <section>
        <empty-state
          .title=${emptyTitle}
          .message=${emptyMessage}
          action-label="Connect"
          @empty-action=${this.onConnect}
        ></empty-state>
      </section>
    `;
  }

  private onConnect() {
    this.dispatchEvent(
      new CustomEvent("connect-requested", { bubbles: true, composed: true }),
    );
  }
}

customElements.define("landing-page", LandingPage);

export {};
