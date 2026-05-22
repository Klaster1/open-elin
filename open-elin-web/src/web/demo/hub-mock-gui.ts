import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";

import { demoHub } from "../store.ts";
import { sharedStyles } from "../styles.ts";

const hubImageUrl = new URL("../images/hub.png", import.meta.url).href;

// Photo-space target for the reset leader line (% of image-wrap).
const RESET_TARGET = { x: 70, y: 18 } as const;

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

      .hub-leader-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
      }

      .hub-leader-line {
        stroke: rgba(255, 200, 140, 0.75);
        stroke-width: 1.2;
        stroke-dasharray: 2 2;
        fill: none;
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
        top: 100px;
        right: 15px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255, 140, 76, 0.7);
        background: rgba(20, 14, 8, 1);
        color: rgba(255, 210, 170, 0.95);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      }

      .hub-reset-button:hover {
        background: rgba(60, 30, 10, 0.9);
        border-color: rgba(255, 170, 110, 0.9);
      }

      .hub-reset-button:active {
        transform: scale(0.96);
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
    const { x: ax, y: ay } = this.resetAnchor;
    return html`
      <div class="hub-mock" role="group" aria-label="Hub controls">
        <div class="hub-mock-frame">
          <div class="hub-image-wrap">
            <img src=${hubImageUrl} alt="Hub" @load=${this.measureAnchors} />
            <svg
              class="hub-leader-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                class="hub-leader-line"
                x1=${ax}
                y1=${ay}
                x2=${RESET_TARGET.x}
                y2=${RESET_TARGET.y}
              />
            </svg>
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

  private resetAnchor: { x: number; y: number } = RESET_TARGET;
  private resizeObserver?: ResizeObserver;

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.measureAnchors());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  protected updated() {
    const wrap = this.renderRoot.querySelector<HTMLElement>(".hub-image-wrap");
    if (wrap && this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(wrap);
    }
    this.measureAnchors();
  }

  private measureAnchors = () => {
    const wrap = this.renderRoot.querySelector<HTMLElement>(".hub-image-wrap");
    const pill = this.renderRoot.querySelector<HTMLElement>(".hub-reset-button");
    if (!wrap || !pill) return;
    const w = wrap.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    if (w.width === 0 || w.height === 0) return;
    const x = ((p.left + p.width / 2) - w.left) / w.width * 100;
    const y = ((p.top + p.height / 2) - w.top) / w.height * 100;
    if (Math.abs(x - this.resetAnchor.x) > 0.1 || Math.abs(y - this.resetAnchor.y) > 0.1) {
      this.resetAnchor = { x, y };
      this.requestUpdate();
    }
  };
}

if (!customElements.get("hub-mock-gui")) {
  customElements.define("hub-mock-gui", HubMockGui);
}

export { };
