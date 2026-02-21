import { LitElement, css, html } from "lit";

import "./empty-state.ts";

export class ConnectionEmptyState extends LitElement {
  static styles = [
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

  private demoFull = false;

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
    return html`
      <section
        role="main"
        data-test-id="connection-empty-state"
        aria-label="Connection"
      >
        <empty-state
          .title=${"Ready to connect"}
          .message=${"No hub connected yet. Click Connect to choose an eLink hub."}
        >
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
      new CustomEvent("connect-action", { bubbles: true, composed: true }),
    );
  }

  private onDemo(event: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent("demo-action", {
        bubbles: true,
        composed: true,
        detail: { altKey: event.altKey },
      }),
    );
  }

  private onWindowKeyDown = (event: KeyboardEvent) => {
    if ((event.altKey || event.key === "Alt") && !this.demoFull) {
      this.demoFull = true;
      this.requestUpdate();
    }
  };

  private onWindowKeyUp = (event: KeyboardEvent) => {
    if ((!event.altKey || event.key === "Alt") && this.demoFull) {
      this.demoFull = false;
      this.requestUpdate();
    }
  };

  private onWindowPointerMove = (event: PointerEvent) => {
    if (event.altKey !== this.demoFull) {
      this.demoFull = event.altKey;
      this.requestUpdate();
    }
  };
}

if (!customElements.get("connection-empty-state")) {
  customElements.define("connection-empty-state", ConnectionEmptyState);
}

export {};
