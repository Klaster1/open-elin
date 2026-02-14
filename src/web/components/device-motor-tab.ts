import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceMotorTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const motorParams = appState.motorParams.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Motor params</h2>
          <p class="hint">Latest motor configuration snapshot.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.onGetMotorParams}
            >Get motor params</sl-button
          >
        </div>
        ${motorParams
          ? html`<pre class="log">${JSON.stringify(motorParams, null, 2)}</pre>`
          : html`<div class="empty-state">No motor params fetched yet.</div>`}
      </div>
    `;
  }

  private async onGetMotorParams() {
    await appActions.getMotorParams();
  }
}

customElements.define("device-motor-tab", DeviceMotorTab);

export {};
