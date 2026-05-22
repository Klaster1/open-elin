import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";

import { ACTION_LABELS, FUNCTION_LABELS } from "open-elin-lib/commands";
import { POD_MODELS } from "open-elin-lib/pod-models";
import "../components/pod-diagram.ts";
import { demoHub, demoPod } from "../store.ts";
import { sharedStyles } from "../styles.ts";

const podModel = POD_MODELS["NXS MTB Pod"];

// Physical button slots → PRIMARY button code (the first sub-code)
const SLOT_BUTTON_CODES: Record<string, string> = {
  up:   "00",  // A
  down: "06",  // B
  tune: "0C",  // C
  pair: "12",  // D
};

const SLOT_POD_BUTTONS: Record<string, "A" | "B" | "C" | "D"> = {
  up: "A",
  down: "B",
  tune: "C",
  pair: "D",
};

const ACTION_TRIGGER_IDS: Record<string, string> = {
  "00": "pod-trigger-press",
  "01": "pod-trigger-release",
  "02": "pod-trigger-double",
};

const ACTION_FLAGS: Record<string, number> = {
  "00": 0,
  "01": 1,
  "02": 2,
};

export class PodMockGui extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .pod-mock {
        width: 100%;
        display: grid;
        place-items: center;
      }

      .pod-mock-frame {
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

      .pod-power {
        position: absolute;
        top: 58%;
        left: 4%;
        transform: translateY(-50%);
      }

      .pod-power::part(label) {
        color: #cfe3ff;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.01em;
      }

      .pod-footer {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }

      .pod-mac-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        font-family: var(--sl-font-mono, ui-monospace, monospace);
        font-size: 12px;
        color: #cfe3ff;
      }

      .pod-mac-label {
        color: #7d93ad;
        font-family: var(--sl-font-sans);
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .pod-mac-row sl-copy-button {
        --success-color: rgba(76, 255, 196, 0.9);
      }

      .pod-mac {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: var(--sl-font-mono, ui-monospace, monospace);
        font-size: 12px;
        color: #cfe3ff;
        background: rgba(8, 14, 22, 0.6);
        border: 1px solid #253245;
        border-radius: 8px;
        padding: 3px 6px;
      }

      .pod-button {
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(76, 255, 196, 0.7);
        background: rgba(8, 14, 22, 1);
        color: rgba(170, 255, 220, 0.95);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      }

      .pod-button:hover {
        background: rgba(20, 50, 40, 1);
        border-color: rgba(140, 255, 220, 0.9);
      }

      .pod-button:active {
        transform: scale(0.96);
      }

      .pod-button-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
      }

      .pod-button-group-label {
        font-size: 9px;
        font-weight: 700;
        color: #7d93ad;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .pod-trigger-btn {
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(76, 255, 196, 0.5);
        background: rgba(8, 14, 22, 1);
        color: rgba(170, 255, 220, 0.95);
        font-size: 9px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }

      .pod-trigger-btn:hover {
        background: rgba(20, 50, 40, 1);
        border-color: rgba(140, 255, 220, 0.9);
      }

      .pod-trigger-btn:active {
        transform: scale(0.96);
      }

      .pod-button-pair.pairing-mode {
        border-color: rgba(76, 200, 255, 0.9);
        background: rgba(20, 40, 60, 1);
        color: rgba(180, 230, 255, 1);
        box-shadow: 0 0 16px rgba(76, 200, 255, 0.5);
      }

      .pod-button-pair .pair-progress {
        position: absolute;
        inset: -3px;
        border-radius: 999px;
        border: 3px solid transparent;
        animation: none;
        pointer-events: none;
      }

      .pod-button-pair.holding .pair-progress {
        border-top-color: rgba(76, 200, 255, 0.9);
        animation: pair-fill 6s linear forwards;
      }

      @keyframes pair-fill {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `,
  ];
  private pressedButtons = new Set<"A" | "B" | "C" | "D">();
  private pairingHoldTimer: ReturnType<typeof setTimeout> | null = null;

  render() {
    const isOnline = demoPod.state.get().online;
    const isPairing = demoHub.pairingWindow.get();
    const buttonTable = demoHub.getButtonTable() ?? [];
    return html`
      <div class="pod-mock" role="group" aria-label="Pod controls">
        <div class="pod-mock-frame">
          <div style="position:relative">
            <pod-diagram .positions=${podModel.buttonPositions}>
              ${this.renderSlotGroup("tune", buttonTable)}
              ${this.renderSlotGroup("up", buttonTable)}
              ${this.renderSlotGroup("down", buttonTable)}
              <div slot="pair" data-test-id="pod-button-group-D">
                <button
                  class="pod-button pod-button-pair ${isPairing ? "pairing-mode" : ""}"
                  type="button"
                  data-test-id="pod-button-pair"
                  @click=${this.onIgnoreClick}
                  @pointerdown=${this.onPairPointerDown}
                  @pointerup=${this.onPairPointerUp}
                  @pointerleave=${this.onPairPointerUp}
                  @pointercancel=${this.onPairPointerUp}
                  aria-label="Pair / Shift down (hold 6s to pair)"
                >
                  Pair
                  <span class="pair-progress" aria-hidden="true"></span>
                </button>
              </div>
            </pod-diagram>
            <sl-switch
              class="pod-power"
              data-test-id="pod-power-switch"
              ?checked=${isOnline}
              @sl-change=${this.onPowerToggle}
            >
              Power
            </sl-switch>
          </div>
          <div class="pod-footer">
            ${demoPod.podMac
              ? html`<div class="pod-mac-row" data-test-id="pod-mac">
                    <span class="pod-mac-label">MAC</span>
                    <span data-test-id="pod-mac-value">${demoPod.podMac}</span>
                    <sl-copy-button
                      value=${demoPod.podMac}
                      copy-label="Copy pod MAC"
                      data-test-id="pod-mac-copy"
                    ></sl-copy-button>
                  </div>`
              : html``}
          </div>
        </div>
      </div>
    `;
  }

  private onIgnoreClick(event: MouseEvent) {
    event.preventDefault();
  }

  private onPowerToggle(event: Event) {
    const target = event.target as HTMLInputElement | null;
    demoPod.setOnline(Boolean(target?.checked));
  }

  private renderSlotGroup(slot: string, buttonTable: any[]) {
    const label = SLOT_POD_BUTTONS[slot] ?? slot;
    const primaryCode = SLOT_BUTTON_CODES[slot];
    const entries = primaryCode
      ? buttonTable.filter(
          (e: any) => (e.button1?.code ?? "").toUpperCase() === primaryCode.toUpperCase(),
        )
      : [];
    return html`
      <div slot=${slot} class="pod-button-group" data-test-id="pod-button-group-${label}">
        <span class="pod-button-group-label">${label}</span>
        ${this.renderTriggerEntries(slot, entries)}
      </div>
    `;
  }

  private renderTriggerEntries(slot: string, entries: any[]) {
    const podButton = SLOT_POD_BUTTONS[slot];
    if (!podButton || !entries.length) return nothing;

    return entries.map((entry: any) => {
      const actionCode = entry.action?.code ?? "00";
      const actionLabel = ACTION_LABELS[actionCode] ?? entry.action?.label ?? "Press";
      const fnLabel = FUNCTION_LABELS[entry.function?.code] ?? entry.function?.label ?? "";
      const testId = ACTION_TRIGGER_IDS[actionCode] ?? `pod-trigger-${actionCode}`;
      const actionFlag = ACTION_FLAGS[actionCode] ?? 0;

      return html`
        <button
          class="pod-trigger-btn"
          type="button"
          data-test-id=${testId}
          @click=${() => demoPod.fireAction(podButton, actionFlag)}
          aria-label="${actionLabel}: ${fnLabel}"
        >${actionLabel}: ${fnLabel}</button>
      `;
    });
  }

  private onPairPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.pressedButtons.has("D")) return;
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
    this.pressedButtons.add("D");
    demoPod.pressButtonDDown();
    target?.classList.add("holding");
    this.pairingHoldTimer = setTimeout(() => {
      this.pairingHoldTimer = null;
      target?.classList.remove("holding");
      this.pressedButtons.delete("D");
      demoHub.pair(demoPod.podMac);
    }, 6000);
  }

  private onPairPointerUp(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.pressedButtons.has("D")) return;
    const target = event.currentTarget as HTMLElement | null;
    target?.releasePointerCapture(event.pointerId);
    target?.classList.remove("holding");
    this.pressedButtons.delete("D");
    if (this.pairingHoldTimer !== null) {
      clearTimeout(this.pairingHoldTimer);
      this.pairingHoldTimer = null;
      demoPod.pressButtonDUp();
    }
  }

  private isPressKey(event: KeyboardEvent) {
    return (
      event.key === " " ||
      event.key === "Enter" ||
      event.key === "Spacebar" ||
      event.key === "Space" ||
      event.code === "Space" ||
      event.code === "Enter"
    );
  }
}

if (!customElements.get("pod-mock-gui")) {
  customElements.define("pod-mock-gui", PodMockGui);
}

export { };
