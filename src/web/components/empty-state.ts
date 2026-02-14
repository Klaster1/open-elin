import { LitElement, html } from "lit";

import { sharedStyles } from "../styles.ts";

class EmptyState extends LitElement {
  static styles = [sharedStyles];

  static properties = {
    title: { type: String },
    message: { type: String },
    actionLabel: { type: String, attribute: "action-label" },
  };

  declare title: string;
  declare message: string;
  declare actionLabel: string;

  constructor() {
    super();
    this.title = "";
    this.message = "";
    this.actionLabel = "";
  }

  render() {
    return html`
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
        <h2 class="empty-title">${this.title}</h2>
        <p class="hint empty-message">${this.message}</p>
        <slot name="actions">
          ${this.actionLabel
            ? html`
                <sl-button variant="primary" @click=${this.onActionClick}>
                  ${this.actionLabel}
                </sl-button>
              `
            : null}
        </slot>
      </div>
    `;
  }

  private onActionClick() {
    this.dispatchEvent(
      new CustomEvent("empty-action", { bubbles: true, composed: true }),
    );
  }
}

customElements.define("empty-state", EmptyState);

export {};
