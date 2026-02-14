import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceButtonsTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const buttonMap = appState.buttonMap.get();
    const buttonTable = appState.buttonTable.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Buttons</h2>
          <p class="hint">Read the button map and table from the hub.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.onReadButtonMap}
            >Read button map</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.onReadButtonTable}
            >Read button table</sl-button
          >
        </div>
        ${buttonMap
          ? html`<pre class="log">${JSON.stringify(buttonMap, null, 2)}</pre>`
          : html`<div class="empty-state">No button map loaded yet.</div>`}
        ${buttonTable
          ? html`<pre class="log">${JSON.stringify(buttonTable, null, 2)}</pre>`
          : html`<div class="empty-state">No button table loaded yet.</div>`}
      </div>
    `;
  }

  private async onReadButtonMap() {
    await appActions.readButtonMap();
  }

  private async onReadButtonTable() {
    await appActions.readButtonTable();
  }
}

customElements.define("device-buttons-tab", DeviceButtonsTab);

export {};
