import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class LandingPage extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
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
            <sl-button variant="primary" @click=${this.onConnect}
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

  private onConnect() {
    this.dispatchEvent(
      new CustomEvent("connect-requested", { bubbles: true, composed: true }),
    );
  }
}

customElements.define("landing-page", LandingPage);

export {};
