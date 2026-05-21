import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { demoPod } from "../store.ts";
import { sharedStyles } from "../styles.ts";

const podImageUrl = new URL("../images/pod.png", import.meta.url).href;

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
        position: relative;
        width: 100%;
        max-width: 220px;
        padding: 12px;
        border-radius: 22px;
        background: #101922;
        border: 1px solid #253245;
        box-shadow: 0 22px 55px rgba(0, 0, 0, 0.55);
      }

      .pod-power {
        position: absolute;
        left: 14px;
        bottom: 12px;
        z-index: 2;
      }

      .pod-power::part(label) {
        color: #cfe3ff;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.01em;
      }

      .pod-mock img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 18px;
      }

      .pod-button {
        position: absolute;
        border-radius: 999px;
        border: 2px solid rgba(76, 255, 196, 0.7);
        background: rgba(76, 255, 196, 0.18);
        box-shadow: 0 0 12px rgba(76, 255, 196, 0.25);
        cursor: pointer;
        transform: translate(-50%, -50%);
      }

      .pod-button:hover {
        background: rgba(76, 255, 196, 0.28);
      }

      .pod-button:active {
        transform: translate(-50%, -50%) scale(0.96);
      }

      .pod-button-tune {
        width: 44px;
        height: 44px;
        top: 37%;
        left: 52%;
      }

      .pod-button-up {
        width: 44px;
        height: 44px;
        top: 37%;
        left: 76%;
      }

      .pod-button-down {
        width: 44px;
        height: 44px;
        top: 75%;
        left: 81%;
      }
    `,
  ];
  private pressedButtons = new Set<"A" | "B" | "C">();

  render() {
    const isOnline = demoPod.state.get().online;
    return html`
      <div class="pod-mock" role="group" aria-label="Pod controls">
        <div class="pod-mock-frame">
          <sl-switch
            class="pod-power"
            data-test-id="pod-power-switch"
            ?checked=${isOnline}
            @sl-change=${this.onPowerToggle}
          >
            Power
          </sl-switch>
          <img src=${podImageUrl} alt="Pod controls" />
          <button
            class="pod-button pod-button-tune"
            type="button"
            data-test-id="pod-button-tune"
            @click=${this.onIgnoreClick}
            @pointerdown=${this.onTunePointerDown}
            @pointerup=${this.onTunePointerUp}
            @pointerleave=${this.onTunePointerUp}
            @pointercancel=${this.onTunePointerUp}
            @keydown=${this.onTuneKeyDown}
            @keyup=${this.onTuneKeyUp}
            aria-label="Toggle tune"
          ></button>
          <button
            class="pod-button pod-button-up"
            type="button"
            data-test-id="pod-button-up"
            @click=${this.onIgnoreClick}
            @pointerdown=${this.onShiftUpPointerDown}
            @pointerup=${this.onShiftUpPointerUp}
            @pointerleave=${this.onShiftUpPointerUp}
            @pointercancel=${this.onShiftUpPointerUp}
            @keydown=${this.onShiftUpKeyDown}
            @keyup=${this.onShiftUpKeyUp}
            aria-label="Shift up"
          ></button>
          <button
            class="pod-button pod-button-down"
            type="button"
            data-test-id="pod-button-down"
            @click=${this.onIgnoreClick}
            @pointerdown=${this.onShiftDownPointerDown}
            @pointerup=${this.onShiftDownPointerUp}
            @pointerleave=${this.onShiftDownPointerUp}
            @pointercancel=${this.onShiftDownPointerUp}
            @keydown=${this.onShiftDownKeyDown}
            @keyup=${this.onShiftDownKeyUp}
            aria-label="Shift down"
          ></button>
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

  private onShiftUpPointerDown(event: PointerEvent) {
    this.onPointerDown(event, "A", () => demoPod.pressButtonADown());
  }

  private onShiftUpPointerUp(event: PointerEvent) {
    this.onPointerUp(event, "A", () => demoPod.pressButtonAUp());
  }

  private onShiftUpKeyDown(event: KeyboardEvent) {
    this.onButtonKeyDown(event, "A", () => demoPod.pressButtonADown());
  }

  private onShiftUpKeyUp(event: KeyboardEvent) {
    this.onButtonKeyUp(event, "A", () => demoPod.pressButtonAUp());
  }

  private onShiftDownPointerDown(event: PointerEvent) {
    this.onPointerDown(event, "B", () => demoPod.pressButtonBDown());
  }

  private onShiftDownPointerUp(event: PointerEvent) {
    this.onPointerUp(event, "B", () => demoPod.pressButtonBUp());
  }

  private onShiftDownKeyDown(event: KeyboardEvent) {
    this.onButtonKeyDown(event, "B", () => demoPod.pressButtonBDown());
  }

  private onShiftDownKeyUp(event: KeyboardEvent) {
    this.onButtonKeyUp(event, "B", () => demoPod.pressButtonBUp());
  }

  private onTunePointerDown(event: PointerEvent) {
    this.onPointerDown(event, "C", () => demoPod.pressButtonCDown());
  }

  private onTunePointerUp(event: PointerEvent) {
    this.onPointerUp(event, "C", () => demoPod.pressButtonCUp());
  }

  private onTuneKeyDown(event: KeyboardEvent) {
    this.onButtonKeyDown(event, "C", () => demoPod.pressButtonCDown());
  }

  private onTuneKeyUp(event: KeyboardEvent) {
    this.onButtonKeyUp(event, "C", () => demoPod.pressButtonCUp());
  }

  private onPointerDown(
    event: PointerEvent,
    button: "A" | "B" | "C",
    action: () => void,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (this.pressedButtons.has(button)) return;
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
    this.pressedButtons.add(button);
    action();
  }

  private onPointerUp(
    event: PointerEvent,
    button: "A" | "B" | "C",
    action: () => void,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.pressedButtons.has(button)) return;
    const target = event.currentTarget as HTMLElement | null;
    target?.releasePointerCapture(event.pointerId);
    this.pressedButtons.delete(button);
    action();
  }

  private onButtonKeyDown(
    event: KeyboardEvent,
    button: "A" | "B" | "C",
    action: () => void,
  ) {
    if (!this.isPressKey(event) || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.pressedButtons.has(button)) return;
    this.pressedButtons.add(button);
    action();
  }

  private onButtonKeyUp(
    event: KeyboardEvent,
    button: "A" | "B" | "C",
    action: () => void,
  ) {
    if (!this.isPressKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!this.pressedButtons.has(button)) return;
    this.pressedButtons.delete(button);
    action();
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

export {};
