import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./empty-state.ts";

class LandingPage extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .demo-button::part(base) {
        background: transparent;
        border-color: #2b3a4b;
        color: var(--muted, #98a6b5);
        opacity: 0.7;
      }

      .demo-button::part(base):hover {
        opacity: 1;
        border-color: #3a4a5c;
        color: var(--text, #e7edf5);
      }
    `,
  ];

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
      <section role="main" aria-label="Connection">
        <empty-state .title=${emptyTitle} .message=${emptyMessage}>
          <div slot="actions" class="actions">
            <sl-button variant="primary" @click=${this.onConnect}
              >Connect</sl-button
            >
            <sl-button class="demo-button" @click=${this.onDemo}
              >Demo</sl-button
            >
          </div>
        </empty-state>
      </section>
    `;
  }

  private onConnect() {
    this.dispatchEvent(
      new CustomEvent("connect-requested", { bubbles: true, composed: true }),
    );
  }

  private onDemo() {
    this.dispatchEvent(
      new CustomEvent("demo-requested", { bubbles: true, composed: true }),
    );
  }
}

customElements.define("landing-page", LandingPage);

export {};
