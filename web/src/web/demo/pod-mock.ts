import { signal } from "@lit-labs/signals";
import type { ButtonActionNotify } from "lib/commands";

type PodMode = "shift" | "tune";

type PodMockOptions = {
  online?: boolean;
  mode?: PodMode;
  batteryLevel?: number;
  podMac?: string;
};

type PodStateShape = {
  online: boolean;
  mode: PodMode;
  batteryLevel: number;
};

type PodButtonActionEvent = ButtonActionNotify;

export class PodMock extends EventTarget {
  readonly state = signal<PodStateShape>({
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

  /** Fire a button action by hex code (e.g. "00", "01", "12") and action flag (0=press, 1=release, 2=double) */
  fireByCode(buttonCodeHex: string, actionFlag: number) {
    if (!this.state.get().online) return;
    this.emitButtonAction(parseInt(buttonCodeHex, 16), actionFlag);
  }

  /** Press + release a button by hex code */
  pressByCode(buttonCodeHex: string) {
    if (!this.state.get().online) return;
    const id = parseInt(buttonCodeHex, 16);
    this.emitButtonAction(id, 0);
    setTimeout(() => {
      this.emitButtonAction(id, 1);
    }, DEFAULT_RELEASE_DELAY_MS);
  }

  private updateState(next: Partial<PodStateShape>) {
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

const ACTION_LABELS: Record<string, string> = {
  "00": "Press",
  "01": "Release",
  "02": "Double press",
};

const BUTTON_LABELS: Record<string, string> = {
  "00": "A",
  "01": "A-1",
  "02": "A-2",
  "12": "D",
};

function toHexByte(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export type PodState = ReturnType<PodMock["state"]["get"]>;
export type { PodButtonActionEvent, PodMockOptions, PodMode };
