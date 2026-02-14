import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceCogsTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const rearCogInfo = appState.rearCogInfo.get();
    const position = appState.position.get();
    const frontCog = appState.frontCogInfo.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Cogs</h2>
          <p class="hint">Rear cog diagnostics and live position snapshots.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.onGetRearCogInfo}
            >Get rear cog info</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.onGetPosition}
            >Get position</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.onShiftUp}
            >Shift up</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.onShiftDown}
            >Shift down</sl-button
          >
        </div>
        ${rearCogInfo
          ? html`<pre class="log">${JSON.stringify(rearCogInfo, null, 2)}</pre>`
          : html`<div class="empty-state">No rear cog info yet.</div>`}
        ${position
          ? html`<pre class="log">${JSON.stringify(position, null, 2)}</pre>`
          : html`<div class="empty-state">No position read yet.</div>`}
        ${frontCog
          ? html`<pre class="log">${JSON.stringify(frontCog, null, 2)}</pre>`
          : html`<div class="empty-state">No front cog notification yet.</div>`}
      </div>
    `;
  }

  private async onGetRearCogInfo() {
    await appActions.getRearCogInfo();
  }

  private async onGetPosition() {
    await appActions.getPosition();
  }

  private async onShiftUp() {
    await appActions.shiftUp();
  }

  private async onShiftDown() {
    await appActions.shiftDown();
  }
}

customElements.define("device-cogs-tab", DeviceCogsTab);

export {};
