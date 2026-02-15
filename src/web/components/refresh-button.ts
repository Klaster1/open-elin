import { LitElement, css, html } from "lit";

import { sharedStyles } from "../styles.ts";
import "./inline-spinner.ts";

class RefreshButton extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .button-icon {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      sl-button::part(prefix) {
        display: inline-flex;
        align-items: center;
      }
    `,
  ];

  static properties = {
    disabled: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
  };

  declare disabled: boolean;
  declare loading: boolean;

  constructor() {
    super();
    this.disabled = false;
    this.loading = false;
  }

  render() {
    const isDisabled = this.disabled || this.loading;
    return html`
      <sl-button
        size="small"
        ?disabled=${isDisabled}
        aria-busy=${this.loading ? "true" : "false"}
        @click=${this.onClick}
      >
        ${this.loading
          ? html`<inline-spinner slot="prefix"></inline-spinner>`
          : html`
              <svg
                slot="prefix"
                class="button-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M20 5v5h-5M4 19v-5h5M6.5 7.5a7 7 0 0 1 11 2.5M17.5 16.5a7 7 0 0 1-11-2.5"
                ></path>
              </svg>
            `}
        <slot>Refresh</slot>
      </sl-button>
    `;
  }

  private onClick() {
    if (this.loading) return;
    this.dispatchEvent(
      new CustomEvent("refresh-requested", { bubbles: true, composed: true }),
    );
  }
}

customElements.define("refresh-button", RefreshButton);

export {};
