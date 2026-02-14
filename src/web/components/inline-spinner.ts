import { LitElement, html } from "lit";

import { sharedStyles } from "../styles.ts";

class InlineSpinner extends LitElement {
  static styles = [sharedStyles];

  render() {
    return html`<sl-spinner
      class="inline-spinner"
      aria-hidden="true"
    ></sl-spinner>`;
  }
}

customElements.define("inline-spinner", InlineSpinner);

export {};
