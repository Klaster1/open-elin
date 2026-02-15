import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { demoPod } from "../store.ts";
import { sharedStyles } from "../styles.ts";

const podImageUrl = new URL("../images/pod.png", import.meta.url).href;

class PodMockGui extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];
  private pressedButtons = new Set<"A" | "B" | "C">();

  render() {
    return html`
      <div class="pod-mock" role="group" aria-label="Pod controls">
        <div class="pod-mock-frame">
          <img src=${podImageUrl} alt="Pod controls" />
          <button
            class="pod-button pod-button-tune"
            type="button"
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

customElements.define("pod-mock-gui", PodMockGui);

export {};
