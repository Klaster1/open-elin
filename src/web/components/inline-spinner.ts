import { LitElement, css, html } from "lit";

import { sharedStyles } from "../styles.ts";

class InlineSpinner extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .inline-spinner {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        --size: 14px;
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
