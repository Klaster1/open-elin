import { LitElement, css, html } from "lit";

import { sharedStyles } from "../styles.ts";

export class EmptyState extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .card {
        background: var(--panel, #141c24);
        border-radius: 16px;
        padding: 18px 20px;
        border: 1px solid var(--panel-border, #223142);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }

      .empty-state {
        margin-top: 16px;
        padding: 18px;
        border-radius: 12px;
        border: 1px dashed #3a4a5c;
        background: rgba(20, 30, 40, 0.6);
        min-height: 140px;
        display: flex;
        align-items: center;
        color: var(--muted, #98a6b5);
      }

      .empty-state.stack {
        margin-top: 0;
        padding: 28px;
        min-height: 280px;
        flex-direction: column;
        text-align: center;
        gap: 14px;
        border-style: solid;
        border-color: #2b3a4b;
        background: rgba(10, 16, 22, 0.8);
      }

      .empty-icon {
        width: 120px;
        height: 120px;
        border-radius: 28px;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 30% 30%, #2d3c4c, #121a24);
        border: 1px solid #2b3a4b;
      }

      .empty-icon svg {
        width: 72px;
        height: 72px;
        opacity: 0.9;
      }

      .empty-title {
        margin: 0;
        font-size: 20px;
        color: var(--text, #e7edf5);
      }

      .empty-message {
        margin: 0;
        max-width: 420px;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }
    `,
  ];

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
      <div class="card empty-state stack" role="status" aria-live="polite">
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

if (!customElements.get("empty-state")) {
  customElements.define("empty-state", EmptyState);
}

export {};
