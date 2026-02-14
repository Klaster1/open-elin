import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class MacPage extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const manualMac = appState.manualMac.get();
    const adStatusKind = appState.adStatusKind.get();
    const adStatusText = appState.adStatusText.get();
    const shiftStatusKind = appState.shiftStatusKind.get();
    const shiftStatusText = appState.shiftStatusText.get();
    return html`
      <section>
        <div class="card">
          <div class="card-head">
            <h2>2. MAC acquisition</h2>
            <p class="hint">
              We need the hub MAC to send commands. Use one of the methods
              below.
            </p>
          </div>
          <div class="pane-grid">
            <div class="pane">
              <h2>Auto discover (ads)</h2>
              <p class="hint">
                We listen for manufacturer data in advertisements.
              </p>
              <div class="status ${adStatusKind}">${adStatusText}</div>
              <p class="hint">Keep the hub awake and nearby.</p>
            </div>
            <div class="pane">
              <h2>Shift a gear</h2>
              <p class="hint">
                Shift once so we receive a Shift Complete event with the MAC.
              </p>
              <div class="status ${shiftStatusKind}">${shiftStatusText}</div>
              <p class="hint">A single shift up or down is enough.</p>
            </div>
            <div class="pane">
              <h2>Manual entry</h2>
              <sl-input
                placeholder="AA:BB:CC:DD:EE:FF"
                value=${manualMac}
                @sl-input=${this.onManualInput}
              ></sl-input>
              <div class="row">
                <sl-button variant="default" @click=${this.onManualApply}
                  >Use this MAC</sl-button
                >
              </div>
              <p class="hint">
                Find the MAC with nRF Connect or any Bluetooth scanner app.
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private onManualInput(event: Event) {
    const target = event.target as HTMLInputElement;
    appActions.setManualMac(target.value);
  }

  private onManualApply() {
    appActions.applyManualMac();
  }
}

customElements.define("mac-page", MacPage);

export {};
