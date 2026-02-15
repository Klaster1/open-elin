import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceCogsTab extends SignalWatcher(LitElement) {
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

      .card-head {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
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

      .log {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid #233143;
        background: #0f1620;
        font-family: Consolas, monospace;
      }
    `,
  ];

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
