import { LitElement, html } from "lit";

import { sharedStyles } from "../styles.ts";

class RefreshButton extends LitElement {
  static styles = [sharedStyles];

  static properties = {
    disabled: { type: Boolean, reflect: true },
  };

  declare disabled: boolean;

  constructor() {
    super();
    this.disabled = false;
  }

  render() {
    return html`
      <sl-button size="small" ?disabled=${this.disabled} @click=${this.onClick}>
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
        <slot>Refresh</slot>
      </sl-button>
    `;
  }

  private onClick() {
    this.dispatchEvent(
      new CustomEvent("refresh-requested", { bubbles: true, composed: true }),
    );
  }
}

customElements.define("refresh-button", RefreshButton);

export {};
