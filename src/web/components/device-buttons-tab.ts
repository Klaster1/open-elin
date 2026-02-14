import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./refresh-button.ts";

class DeviceButtonsTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  connectedCallback() {
    super.connectedCallback();
    if (appState.connected.get() && appState.mac.get()) {
      void appActions.readButtonTable();
    }
  }

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const buttonTable = appState.buttonTable.get();
    return html`
      <div class="card">
        <div class="card-head">
          <div class="card-head-row">
            <h2>Buttons</h2>
            <refresh-button
              ?disabled=${!canSend}
              @refresh-requested=${this.onReadButtonTable}
            ></refresh-button>
          </div>
          <p class="hint">Current button-to-action mapping per pod.</p>
        </div>
        ${buttonTable?.length
          ? html`<div class="mapping-list">
              ${buttonTable.map((entry: any, index: number) =>
                this.renderMapping(entry, index),
              )}
            </div>`
          : html`<div class="empty-state">No button table loaded yet.</div>`}
      </div>
    `;
  }

  private async onReadButtonTable() {
    await appActions.readButtonTable();
  }

  private renderMapping(entry: any, index: number) {
    const pod = this.formatMac(entry?.podAddressHex);
    const button1 = entry?.button1?.label || "-";
    const button2 = entry?.button2?.label || "-";
    const action = entry?.action?.label || "-";
    const fnLabel = entry?.function?.label || "-";
    const buttons =
      button2 && button2 !== "-" ? `${button1} + ${button2}` : button1;

    return html`
      <div class="mapping-card">
        <div class="mapping-head">
          <div>
            <div class="mapping-title">${fnLabel}</div>
            <div class="mapping-subtitle">Pod ${pod || "--"}</div>
          </div>
          <div class="mapping-badge">#${index + 1}</div>
        </div>
        <dl class="mapping-grid">
          <div>
            <dt>Buttons</dt>
            <dd>${buttons}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>${action}</dd>
          </div>
        </dl>
      </div>
    `;
  }

  private formatMac(hex?: string) {
    if (!hex || hex.length < 12) return "";
    const pairs: string[] = [];
    for (let i = 0; i < 12; i += 2) {
      pairs.push(hex.substring(i, i + 2));
    }
    return pairs.reverse().join(":").toUpperCase();
  }
}

customElements.define("device-buttons-tab", DeviceButtonsTab);

export {};
