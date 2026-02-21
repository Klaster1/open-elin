import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./empty-state.ts";

export class LandingPage extends SignalWatcher(LitElement) {
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

  static properties = {
    demoFull: { type: Boolean, attribute: false },
  };

  declare demoFull: boolean;

  constructor() {
    super();
    this.demoFull = false;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.onWindowKeyDown);
    window.addEventListener("keyup", this.onWindowKeyUp);
    window.addEventListener("pointermove", this.onWindowPointerMove);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.onWindowKeyDown);
    window.removeEventListener("keyup", this.onWindowKeyUp);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    super.disconnectedCallback();
  }

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
      <section role="main" aria-label="Connection" data-test-id="landing-page">
        <empty-state .title=${emptyTitle} .message=${emptyMessage}>
          <div slot="actions" class="actions">
            <sl-button
              variant="primary"
              data-test-id="landing-connect-button"
              @click=${this.onConnect}
              >Connect</sl-button
            >
            <sl-button
              class="demo-button"
              data-test-id="landing-demo-button"
              @click=${this.onDemo}
              >${this.demoFull ? "Demo (full)" : "Demo"}</sl-button
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

  private onDemo(event: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent("demo-requested", {
        bubbles: true,
        composed: true,
        detail: { full: this.demoFull || event.altKey },
      }),
    );
  }

  private onWindowKeyDown = (event: KeyboardEvent) => {
    if ((event.altKey || event.key === "Alt") && !this.demoFull) {
      this.demoFull = true;
    }
  };

  private onWindowKeyUp = (event: KeyboardEvent) => {
    if ((!event.altKey || event.key === "Alt") && this.demoFull) {
      this.demoFull = false;
    }
  };

  private onWindowPointerMove = (event: PointerEvent) => {
    if (event.altKey !== this.demoFull) {
      this.demoFull = event.altKey;
    }
  };
}

if (!customElements.get("landing-page")) {
  customElements.define("landing-page", LandingPage);
}

export {};
