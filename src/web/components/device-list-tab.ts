import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceListTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const canList = appState.connected.get();
    const entries = appState.listEntries.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Device list</h2>
          <p class="hint">Scan the hub for linked devices.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canList} @click=${this.onGetList}
            >Get list</sl-button
          >
        </div>
        ${entries.length
          ? html`<pre class="log">
${entries
                .map((entry, index) => `${index + 1}. ${JSON.stringify(entry)}`)
                .join("\n")}</pre
            >`
          : html`<div class="empty-state">No device list loaded yet.</div>`}
      </div>
    `;
  }

  private async onGetList() {
    await appActions.getList();
  }
}

customElements.define("device-list-tab", DeviceListTab);

export {};
