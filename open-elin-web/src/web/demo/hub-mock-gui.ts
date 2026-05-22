import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { demoHub } from "../store.ts";
import { sharedStyles } from "../styles.ts";

const hubImageUrl = new URL("../images/hub.png", import.meta.url).href;

export class HubMockGui extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .hub-mock {
        width: 100%;
        display: grid;
        place-items: center;
      }

      .hub-mock-frame {
        width: 100%;
        max-width: 220px;
        padding: 12px;
        border-radius: 22px;
        background: #101922;
        border: 1px solid #253245;
        box-shadow: 0 22px 55px rgba(0, 0, 0, 0.55);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .hub-image-wrap {
        position: relative;
      }

      .hub-mock img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 18px;
      }

      .hub-mac-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        font-family: var(--sl-font-mono, ui-monospace, monospace);
        font-size: 12px;
        color: #cfe3ff;
      }

      .hub-mac-label {
        color: #7d93ad;
        font-family: var(--sl-font-sans);
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .hub-mac-row sl-copy-button {
        --success-color: rgba(76, 255, 196, 0.9);
      }

      .hub-reset-button {
        position: absolute;
        width: 44px;
        height: 44px;
        top: 20%;
        left: 20%;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        border: 2px solid rgba(255, 140, 76, 0.7);
        background: rgba(255, 140, 76, 0.18);
        box-shadow: 0 0 12px rgba(255, 140, 76, 0.25);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 200, 140, 0.9);
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .hub-reset-button:hover {
        background: rgba(255, 140, 76, 0.28);
      }

      .hub-reset-button:active {
        transform: translate(-50%, -50%) scale(0.96);
      }

      .pairing-badge {
        margin-top: 10px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(76, 200, 255, 0.15);
        border: 1px solid rgba(76, 200, 255, 0.5);
        color: #7edeff;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        animation: pairing-pulse 1.5s ease-in-out infinite;
      }

      @keyframes pairing-pulse {
        0%, 100% { box-shadow: 0 0 4px rgba(76, 200, 255, 0.3); }
        50% { box-shadow: 0 0 14px rgba(76, 200, 255, 0.7); }
      }
    `,
  ];

  render() {
    const isPairing = demoHub.pairingWindow.get();
    const hubMac = demoHub.state.get().device.mac;
    return html`
      <div class="hub-mock" role="group" aria-label="Hub controls">
        <div class="hub-mock-frame">
          <div class="hub-image-wrap">
            <img src=${hubImageUrl} alt="Hub" />
            <button
              class="hub-reset-button"
              type="button"
              data-test-id="hub-reset-button"
              @click=${this.onResetClick}
              aria-label="Factory reset hub"
              title="Factory reset hub"
            >
              Reset
            </button>
          </div>
          ${hubMac
            ? html`<div class="hub-mac-row" data-test-id="hub-mac">
                <span class="hub-mac-label">MAC</span>
                <span data-test-id="hub-mac-value">${hubMac}</span>
                <sl-copy-button
                  value=${hubMac}
                  copy-label="Copy hub MAC"
                  data-test-id="hub-mac-copy"
                ></sl-copy-button>
              </div>`
            : html``}
        </div>
        ${isPairing
          ? html`<div class="pairing-badge" role="status" aria-live="polite">Pairing window open</div>`
          : html``}
      </div>
    `;
  }

  private onResetClick() {
    demoHub.reset();
  }
}

if (!customElements.get("hub-mock-gui")) {
  customElements.define("hub-mock-gui", HubMockGui);
}

export {};
