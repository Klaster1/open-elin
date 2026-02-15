import { signal } from "@lit-labs/signals";
import type { ButtonActionNotify } from "../commands.ts";

type PodMode = "shift" | "tune";

type PodMockOptions = {
  online?: boolean;
  mode?: PodMode;
  batteryLevel?: number;
  podMac?: string;
};

type PodState = {
  online: boolean;
  mode: PodMode;
  batteryLevel: number;
};

type PodButtonActionEvent = ButtonActionNotify;

type PodButton = "A" | "B" | "C";

export class PodMock extends EventTarget {
  readonly state = signal<PodState>({
    online: true,
    mode: "shift",
    batteryLevel: 3000,
  });
  readonly podMac: string;

  constructor(options: PodMockOptions = {}) {
    super();
    if (typeof options.online === "boolean") {
      this.setOnline(options.online);
    }
    if (options.mode) {
      this.setMode(options.mode);
    }
    if (typeof options.batteryLevel === "number") {
      this.setBatteryLevel(options.batteryLevel);
    }
    this.podMac = options.podMac ?? "";
  }

  setOnline(next: boolean) {
    this.updateState({ online: next });
  }

  setMode(next: PodMode) {
    this.updateState({ mode: next });
  }

  toggleMode() {
    const current = this.state.get();
    this.updateState({ mode: current.mode === "shift" ? "tune" : "shift" });
  }

  setBatteryLevel(millivolts: number) {
    this.updateState({ batteryLevel: millivolts });
  }

  pressButtonA() {
    this.emitButtonSequence("A");
  }

  pressButtonB() {
    this.emitButtonSequence("B");
  }

  pressButtonC() {
    if (!this.state.get().online) return;
    this.toggleMode();
    this.emitButtonAction(BUTTON_IDS.C, 0);
    setTimeout(() => {
      this.emitButtonAction(BUTTON_IDS.C, 1);
    }, DEFAULT_RELEASE_DELAY_MS);
  }

  private emitButtonSequence(button: PodButton) {
    const current = this.state.get();
    if (!current.online) return;
    const buttonId = BUTTON_IDS[button];
    const releaseDelay =
      current.mode === "tune"
        ? TUNE_RELEASE_DELAY_MS
        : DEFAULT_RELEASE_DELAY_MS;
    this.emitButtonAction(buttonId, 0);
    setTimeout(() => {
      this.emitButtonAction(buttonId, 1);
    }, releaseDelay);
  }

  private updateState(next: Partial<PodState>) {
    const current = this.state.get();
    this.state.set({ ...current, ...next });
  }

  private emitButtonAction(buttonId: number, actionFlag: number) {
    const buttonHex = toHexByte(buttonId);
    const actionHex = toHexByte(actionFlag);
    const detail: PodButtonActionEvent = {
      status: "success",
      code: 0x4001,
      targetMac: this.podMac || undefined,
      buttonId,
      buttonHex,
      buttonLabel: BUTTON_LABELS[buttonHex],
      actionFlag,
      actionLabel: ACTION_LABELS[actionHex],
      rawHex: `${buttonHex}${actionHex}`,
      rawBytes: [buttonId & 0xff, actionFlag & 0xff],
    };
    this.dispatchEvent(new CustomEvent("pod-button-action", { detail }));
  }
}

const DEFAULT_RELEASE_DELAY_MS = 40;
const TUNE_RELEASE_DELAY_MS = 800;

const BUTTON_IDS: Record<PodButton, number> = {
  A: 1,
  B: 0,
  C: 2,
};

const ACTION_LABELS: Record<string, string> = {
  "00": "Press",
  "01": "Release",
};

const BUTTON_LABELS: Record<string, string> = {
  "00": "-",
  "01": "A-1",
  "02": "A-2",
};

function toHexByte(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export type { PodMode, PodMockOptions, PodButtonActionEvent };
