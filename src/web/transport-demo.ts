import type {
  ProtocolTransport,
  TransportConnection,
  TransportDevice,
} from "../protocol.ts";
import { hexToBuffer, reverseMacAddress } from "../protocol.ts";
import { demoState } from "./demo-state.ts";
import type { DemoBatterySample } from "./demo-state.ts";
import type { PodMock } from "./pod-mock.ts";

type MessageHandler = (data: Uint8Array) => void;

type DemoShiftComplete = { rawHex: string };

const DEMO_RESPONSE_CODE = 0x8000;
const DEMO_BATTERY_CODE = 0x4000;
const DEMO_BUTTON_ACTION_CODE = 0x4001;
const DEMO_BUTTON_TABLE_CODE = 0x4002;
const DEMO_SHIFT_COMPLETE_CODE = 0x4003;

const DEMO_RESPONSE_DELAY_MS = 350;
const DEMO_NOTIFY_DELAY_MS = 400;
const DEMO_SHIFT_DELAY_MS = 650;
const DEMO_BATTERY_INTERVAL_MS = 5000;
const TUNE_STEP = 0.2;

const BUTTON_SHIFT_MAP: Record<number, "up" | "down"> = {
  1: "up",
  0: "down",
};

export class DemoTransport implements ProtocolTransport {
  private msgHandler: MessageHandler | null = null;
  private pinHandler: MessageHandler | null = null;
  private batteryTimer: ReturnType<typeof setInterval> | null = null;
  private batteryIndex = 0;
  private podListenersAttached = false;
  private readonly onPodButtonAction = (event: Event) => {
    const detail = (event as CustomEvent).detail as
      | { rawBytes?: number[]; buttonId?: number; actionFlag?: number }
      | undefined;
    if (!detail) return;
    if (!this.pod.state.get().online) return;
    const payload = this.buildButtonActionPayload(detail);
    if (!payload) return;
    const podMac = this.getPodMac();
    if (!podMac) return;
    this.queueNotify(DEMO_BUTTON_ACTION_CODE, podMac, payload);
    if (detail.buttonId !== undefined && detail.actionFlag !== undefined) {
      this.handlePodButtonAction(detail.buttonId, detail.actionFlag);
    }
  };

  constructor(private readonly pod: PodMock) {}

  private attachPodListeners() {
    if (this.podListenersAttached) return;
    this.pod.addEventListener("pod-button-action", this.onPodButtonAction);
    this.podListenersAttached = true;
  }

  private detachPodListeners() {
    if (!this.podListenersAttached) return;
    this.pod.removeEventListener("pod-button-action", this.onPodButtonAction);
    this.podListenersAttached = false;
  }

  async listDevices() {
    return [this.buildDemoDevice()];
  }

  async connect(device: TransportDevice): Promise<TransportConnection> {
    this.attachPodListeners();
    return {
      macAddress: device.address,
      writeWithoutResponse: false,
      writeMsg: async (payload) => {
        this.handleWrite(payload, device);
      },
      writePin: async () => {
        this.pinHandler?.(new Uint8Array([0x01]));
      },
      subscribeMsg: async (handler) => {
        this.msgHandler = handler;
        this.startBatteryNotifications();
      },
      subscribePin: async (handler) => {
        this.pinHandler = handler;
      },
      disconnect: async () => {
        this.stopBatteryNotifications();
        this.msgHandler = null;
        this.pinHandler = null;
        this.detachPodListeners();
      },
    };
  }

  private handleWrite(payload: Uint8Array, device: TransportDevice) {
    const opcode = payload.length >= 2 ? payload[0] | (payload[1] << 8) : 0;
    switch (opcode) {
      case 0x0000:
        this.queueResponse(device.address, this.buildListPayload());
        return;
      case 0x0015:
        this.queueResponse(
          device.address,
          this.pod.state.get().online
            ? this.buildButtonMapPayload()
            : undefined,
        );
        if (this.pod.state.get().online) {
          this.queueNotify(
            DEMO_BUTTON_TABLE_CODE,
            device.address,
            this.buildButtonTablePayload(),
          );
        }
        return;
      case 0x001f:
        this.queueResponse(
          device.address,
          this.pod.state.get().online ? this.buildRearCogPayload() : undefined,
        );
        return;
      case 0x0013:
        this.queueResponse(
          device.address,
          this.pod.state.get().online ? this.buildPositionPayload() : undefined,
        );
        return;
      case 0x0010:
        this.queueResponse(device.address);
        this.handleShift(device.address, "up");
        return;
      case 0x0011:
        this.queueResponse(device.address);
        this.handleShift(device.address, "down");
        return;
      case 0x0017:
        this.queueResponse(device.address, this.buildMotorParamsPayload());
        return;
      case 0x0009:
        this.queueResponse(device.address);
        return;
      case 0x0004:
      default:
        this.queueResponse(device.address);
    }
  }

  private queueResponse(
    targetMac: string,
    payload?: Uint8Array,
    delayMs = DEMO_RESPONSE_DELAY_MS,
  ) {
    setTimeout(() => {
      this.emitFrame(DEMO_RESPONSE_CODE, targetMac, payload);
    }, delayMs);
  }

  private queueNotify(
    code: number,
    targetMac: string,
    payload?: Uint8Array,
    delayMs = DEMO_NOTIFY_DELAY_MS,
  ) {
    setTimeout(() => {
      this.emitFrame(code, targetMac, payload);
    }, delayMs);
  }

  private queueShiftComplete(targetMac: string, shift: DemoShiftComplete) {
    const payload = this.hexToBytes(shift.rawHex);
    this.queueNotify(
      DEMO_SHIFT_COMPLETE_CODE,
      targetMac,
      payload,
      DEMO_SHIFT_DELAY_MS,
    );
  }

  private emitFrame(code: number, targetMac: string, payload?: Uint8Array) {
    if (!this.msgHandler) return;
    const macBytes = this.macToBytes(targetMac);
    const extra = payload ?? new Uint8Array();
    const out = new Uint8Array(2 + macBytes.length + extra.length);
    out[0] = code & 0xff;
    out[1] = (code >> 8) & 0xff;
    out.set(macBytes, 2);
    if (extra.length) {
      out.set(extra, 2 + macBytes.length);
    }
    this.msgHandler(out);
  }

  private buildListPayload() {
    const entries = this.getListEntries();
    const totalBytes = entries.length * 27;
    const out = new Uint8Array(totalBytes);
    entries.forEach((entry, index) => {
      const offset = index * 27;
      const macBytes = this.macToBytes(entry.mac);
      out.set(macBytes, offset);
      out.set(this.encodeName(entry.name), offset + 6);
      out[offset + 22] = entry.deviceId & 0xff;
      out[offset + 23] = entry.isConnected ? 1 : 0;
      out[offset + 24] = entry.batteryVoltage & 0xff;
      out[offset + 25] = (entry.batteryVoltage >> 8) & 0xff;
      out[offset + 26] = entry.rssi & 0xff;
    });
    return out;
  }

  private buildButtonMapPayload() {
    const mapBytes = demoState.state.get().buttonMap.mapBytes;
    return this.reverseBytes(Uint8Array.from(mapBytes));
  }

  private buildButtonTablePayload() {
    const entries = demoState.state.get().buttonTable;
    const out = new Uint8Array(entries.length * 16);
    entries.forEach((entry, index) => {
      const offset = index * 16;
      out.set(this.hexToBytes(entry.podAddressHex), offset);
      out.set(this.hexToBytes(entry.elinkAddressHex), offset + 6);
      out[offset + 12] = this.hexToByte(entry.button1.code);
      out[offset + 13] = this.hexToByte(entry.button2.code);
      out[offset + 14] = this.hexToByte(entry.action.code);
      out[offset + 15] = this.hexToByte(entry.function.code);
    });
    return out;
  }

  private buildRearCogPayload() {
    const raw = Uint8Array.from(demoState.state.get().rearCogInfo.rawBytes);
    return this.reverseBytes(raw);
  }

  private buildPositionPayload() {
    return Uint8Array.from(demoState.state.get().position.rawBytes);
  }

  private buildMotorParamsPayload() {
    return Uint8Array.from(demoState.state.get().motorParams.rawBytes);
  }

  private startBatteryNotifications() {
    if (this.batteryTimer) return;
    this.emitBatterySample();
    this.batteryTimer = setInterval(() => {
      this.emitBatterySample();
    }, DEMO_BATTERY_INTERVAL_MS);
  }

  private stopBatteryNotifications() {
    if (!this.batteryTimer) return;
    clearInterval(this.batteryTimer);
    this.batteryTimer = null;
  }

  private emitBatterySample() {
    const samples = demoState.state.get().batteryNotifications;
    if (!samples.length) return;
    const podMac = demoState.getPodMac();
    const podOnline = this.pod.state.get().online;

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[this.batteryIndex % samples.length];
      this.batteryIndex += 1;
      if (!podOnline && podMac && sample.targetMac === podMac) {
        continue;
      }
      const payload = this.hexToBytes(sample.rawHex);
      this.emitFrame(DEMO_BATTERY_CODE, sample.targetMac, payload);
      return;
    }
  }

  private buildDemoDevice(): TransportDevice {
    const device = demoState.state.get().device;
    return {
      id: device.id || "demo-device",
      address: device.mac,
      name: device.name,
      rssi: device.rssi ?? 0,
      peripheral: null,
    };
  }

  private getListEntries() {
    const entries = demoState.state.get().list.entries;
    if (this.pod.state.get().online) return entries;
    const podMac = demoState.getPodMac();
    if (!podMac) return entries;
    return entries.filter((entry) => entry.mac !== podMac);
  }

  private getHubMac() {
    return demoState.state.get().device.mac || "";
  }

  private getPodMac() {
    return demoState.getPodMac();
  }

  private buildButtonActionPayload(detail: {
    rawBytes?: number[];
    buttonId?: number;
    actionFlag?: number;
  }) {
    if (detail.rawBytes?.length) {
      return Uint8Array.from(detail.rawBytes);
    }
    if (detail.buttonId === undefined || detail.actionFlag === undefined) {
      return undefined;
    }
    return new Uint8Array([detail.buttonId & 0xff, detail.actionFlag & 0xff]);
  }

  private handleShift(targetMac: string, direction: "up" | "down") {
    if (!this.pod.state.get().online) return;
    if (this.pod.state.get().mode === "tune") {
      this.applyTuneShift(direction);
    } else {
      this.applyGearShift(direction);
    }
    const shift = demoState.state.get().shiftComplete[direction];
    if (shift) {
      this.queueShiftComplete(targetMac, shift);
    }
  }

  private handlePodButtonAction(buttonId: number, actionFlag: number) {
    const direction = BUTTON_SHIFT_MAP[buttonId];
    if (!direction) return;
    const mode = this.pod.state.get().mode;
    if (mode === "tune" && actionFlag === 0) {
      this.handleShift(this.getHubMac(), direction);
      return;
    }
    if (mode === "shift" && actionFlag === 1) {
      this.handleShift(this.getHubMac(), direction);
    }
  }

  private applyGearShift(direction: "up" | "down") {
    const positionState = demoState.state.get().position;
    const rearState = demoState.state.get().rearCogInfo;
    const { absolutePosition, gearPosition } = this.parsePositionBytes(
      positionState.rawBytes,
    );
    const values = this.decodeRearCogValues(rearState.rawBytes);
    if (!values.length) return;
    const currentGear = gearPosition ?? 1;
    const delta = direction === "up" ? 1 : -1;
    const nextGear = this.clampGear(currentGear + delta, values.length);
    const nextAbsolute = values[nextGear - 1] ?? absolutePosition ?? 0;
    const nextPosition = this.buildPositionBytes(nextAbsolute, nextGear);
    this.updatePosition(nextPosition);
  }

  private applyTuneShift(direction: "up" | "down") {
    const positionState = demoState.state.get().position;
    const rearState = demoState.state.get().rearCogInfo;
    const { absolutePosition, gearPosition } = this.parsePositionBytes(
      positionState.rawBytes,
    );
    const currentGear = gearPosition ?? 1;
    const delta = direction === "up" ? TUNE_STEP : -TUNE_STEP;
    const nextAbsolute = (absolutePosition ?? 0) + delta;
    const nextPosition = this.buildPositionBytes(nextAbsolute, currentGear);
    this.updatePosition(nextPosition);
    const nextRear = this.updateRearCogValue(
      rearState.rawBytes,
      currentGear,
      delta,
    );
    this.updateRearCogInfo(nextRear);
  }

  private parsePositionBytes(rawBytes: number[]) {
    const payload = Uint8Array.from(rawBytes);
    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    );
    const absolutePosition =
      payload.length >= 2 ? view.getUint16(0, true) / 10 : undefined;
    const gearHex = payload.length > 2 ? this.bytesToHex(payload.slice(2)) : "";
    const gearPosition = gearHex ? parseInt(gearHex, 16) + 1 : undefined;
    return { absolutePosition, gearPosition };
  }

  private buildPositionBytes(absolutePosition: number, gearPosition: number) {
    const scaled = Math.max(0, Math.round(absolutePosition * 10));
    const gear = Math.max(1, Math.round(gearPosition));
    return new Uint8Array([
      scaled & 0xff,
      (scaled >> 8) & 0xff,
      (gear - 1) & 0xff,
    ]);
  }

  private decodeRearCogValues(rawBytes: number[]) {
    const rawHex = this.bytesToHex(Uint8Array.from(rawBytes));
    const values: number[] = [];
    if (rawHex.length % 6 === 0 && rawHex.length > 0) {
      const chunks: string[] = [];
      for (let i = 0; i < rawHex.length; i += 6) {
        chunks.push(rawHex.substring(i, i + 6));
      }
      for (const chunk of chunks.reverse()) {
        if (chunk.length !== 6) continue;
        const valueHex = chunk.substring(2, 6);
        const value = parseInt(valueHex, 16) / 10;
        if (!Number.isNaN(value)) values.push(value);
      }
    }
    return values;
  }

  private updateRearCogValue(
    rawBytes: number[],
    gearPosition: number,
    delta: number,
  ) {
    const out = Uint8Array.from(rawBytes);
    const chunkCount = Math.floor(out.length / 3);
    if (!chunkCount) return out;
    const clampedGear = this.clampGear(gearPosition, chunkCount);
    const chunkIndex = chunkCount - clampedGear;
    const offset = chunkIndex * 3;
    const currentValue = ((out[offset + 1] << 8) | out[offset + 2]) / 10;
    const nextValue = Math.max(0, currentValue + delta);
    const scaled = Math.round(nextValue * 10);
    out[offset + 1] = (scaled >> 8) & 0xff;
    out[offset + 2] = scaled & 0xff;
    return out;
  }

  private updatePosition(bytes: Uint8Array) {
    const current = demoState.state.get();
    const nextPosition = { ...current.position };
    nextPosition.rawBytes = Array.from(bytes.values());
    nextPosition.rawHex = this.bytesToHex(bytes);
    demoState.state.set({ ...current, position: nextPosition });
  }

  private updateRearCogInfo(bytes: Uint8Array) {
    const current = demoState.state.get();
    const nextRear = { ...current.rearCogInfo };
    nextRear.rawBytes = Array.from(bytes.values());
    nextRear.rawHex = this.bytesToHex(bytes);
    demoState.state.set({ ...current, rearCogInfo: nextRear });
  }

  private clampGear(value: number, max: number) {
    if (Number.isNaN(value)) return 1;
    return Math.min(Math.max(value, 1), max);
  }

  private macToBytes(mac: string) {
    return hexToBuffer(reverseMacAddress(mac));
  }

  private encodeName(name: string) {
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      if (i < name.length) {
        const code = name.charCodeAt(i);
        out[i] = Number.isNaN(code) ? 0x00 : code;
      } else {
        out[i] = 0x00;
      }
    }
    return out;
  }

  private hexToBytes(hex: string) {
    return hexToBuffer(hex);
  }

  private hexToByte(hex: string) {
    return parseInt(hex, 16) & 0xff;
  }

  private reverseBytes(bytes: Uint8Array) {
    const out = Uint8Array.from(bytes);
    out.reverse();
    return out;
  }

  private bytesToHex(bytes: Uint8Array) {
    return Array.from(bytes.values())
      .map((value) => value.toString(16).padStart(2, "0").toUpperCase())
      .join("");
  }
}

export type { DemoBatterySample, DemoShiftComplete };
