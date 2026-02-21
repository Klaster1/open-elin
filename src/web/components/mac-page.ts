import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "../demo/pod-mock-gui.ts";

export class MacPage extends SignalWatcher(LitElement) {
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

      .pane-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .pane {
        background: var(--panel-strong, #1a2430);
        border-radius: 14px;
        padding: 16px;
        border: 1px solid #2b3a4b;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 200px;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        background: #243243;
        color: var(--muted, #98a6b5);
      }

      .status.ok {
        background: rgba(53, 194, 139, 0.18);
        color: #7ef0c3;
      }

      .status.warn {
        background: rgba(255, 180, 84, 0.15);
        color: var(--warn, #ffb454);
      }

      .status.crit {
        background: rgba(255, 102, 102, 0.16);
        color: #ff8a8a;
      }

      .status.wait {
        background: rgba(88, 110, 134, 0.2);
        color: #c0cad6;
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }

      sl-input::part(base) {
        border-radius: 10px;
        border-color: #2b3b4c;
        background: #0e141b;
        color: inherit;
      }

      sl-input::part(form-control) {
        gap: 6px;
      }

      @media (max-width: 900px) {
        .pane-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  render() {
    const manualMac = appState.manualMac.get();
    const adStatusKind = appState.adStatusKind.get();
    const adStatusText = appState.adStatusText.get();
    const shiftStatusKind = appState.shiftStatusKind.get();
    const shiftStatusText = appState.shiftStatusText.get();
    const isDemoMode = appState.demoMode.get();
    return html`
      <section role="main" aria-label="MAC acquisition" data-test-id="mac-page">
        <div class="card">
          <div class="card-head">
            <h2>MAC acquisition</h2>
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
              <div
                class="status ${adStatusKind}"
                data-test-id="mac-ad-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                ${adStatusText}
              </div>
              <p class="hint">Keep the hub awake and nearby.</p>
            </div>
            <div class="pane">
              <h2>Shift a gear</h2>
              <p class="hint">
                Shift once so we receive a Shift Complete event with the MAC.
              </p>
              <div
                class="status ${shiftStatusKind}"
                data-test-id="mac-shift-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                ${shiftStatusText}
              </div>
              <p class="hint">A single shift up or down is enough.</p>
              ${isDemoMode
                ? html`<pod-mock-gui
                    data-test-id="mac-pod-controls"
                  ></pod-mock-gui>`
                : ""}
            </div>
            <div class="pane">
              <h2>Manual entry</h2>
              <sl-input
                data-test-id="mac-manual-input"
                label="Hub MAC address"
                placeholder="AA:BB:CC:DD:EE:FF"
                help-text="Format: AA:BB:CC:DD:EE:FF"
                value=${manualMac}
                @sl-input=${this.onManualInput}
              ></sl-input>
              <div class="row">
                <sl-button
                  variant="default"
                  data-test-id="mac-manual-apply"
                  @click=${this.onManualApply}
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
    if (appState.mac.get()) {
      this.dispatchEvent(
        new CustomEvent("mac-acquired", { bubbles: true, composed: true }),
      );
    }
  }
}

if (!customElements.get("mac-page")) {
  customElements.define("mac-page", MacPage);
}

export {};
