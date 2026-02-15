import { LitElement, css, html } from "lit";

import { sharedStyles } from "../styles.ts";

class InlineSpinner extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .inline-spinner {
        font-size: 14px;
      }
    `,
  ];

  render() {
    return html`<sl-spinner
      class="inline-spinner"
      aria-hidden="true"
    ></sl-spinner>`;
  }
}

customElements.define("inline-spinner", InlineSpinner);

export {};
