import type {
  ProtocolTransport,
  TransportConnection,
  TransportDevice,
} from "open-elin-lib/protocol";
import { hexToBuffer, reverseMacAddress } from "open-elin-lib/protocol";
import type { DemoBatterySample } from "./demo-state.ts";
import { demoState } from "./demo-state.ts";
import type { HubMock } from "./hub-mock.ts";
import type { PodMock } from "./pod-mock.ts";

type MessageHandler = (data: Uint8Array) => void;

type DemoShiftComplete = { rawHex: string };

const DEMO_RESPONSE_CODE = 0x8000;
const DEMO_STATUS_INVALID_STATE = 0x8003;
const DEMO_STATUS_INVALID_PARAM = 0x8002;
const DEMO_BATTERY_CODE = 0x4000;
const DEMO_BUTTON_ACTION_CODE = 0x4001;
const DEMO_BUTTON_TABLE_CODE = 0x4002;
const DEMO_SHIFT_COMPLETE_CODE = 0x4003;

const TUNE_STEP = 0.2;

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

  constructor(
    private readonly pod: PodMock,
    private readonly hub: HubMock,
  ) { }

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
      case 0x0001:
        this.handleAddDevice(payload, device.address);
        return;
      case 0x0002:
        this.handleRemoveDevice(payload, device.address);
        return;
      case 0x0005:
        this.queueResponse(device.address);
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
      case 0x001d:
        if (!this.pod.state.get().online) {
          this.queueResponse(
            device.address,
            undefined,
            undefined,
            DEMO_STATUS_INVALID_PARAM,
          );
          return;
        }
        if (this.applyRearCogInfo(payload)) {
          this.queueResponse(device.address);
        } else {
          this.queueResponse(
            device.address,
            undefined,
            undefined,
            DEMO_STATUS_INVALID_PARAM,
          );
        }
        return;
      case 0x0013:
        this.queueResponse(
          device.address,
          this.pod.state.get().online ? this.buildPositionPayload() : undefined,
        );
        return;
      case 0x000e:
        if (this.pod.state.get().online) {
          this.applyAbsoluteMove(payload);
        }
        this.queueResponse(device.address);
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
        if (this.applyRename(payload)) {
          this.queueResponse(device.address);
        } else {
          this.queueResponse(
            device.address,
            undefined,
            undefined,
            DEMO_STATUS_INVALID_PARAM,
          );
        }
        return;
      case 0x0014:
        this.handleWriteButtonMap(payload, device.address);
        return;
      case 0x0004:
        this.hub.blinkLed();
        this.queueResponse(device.address);
        return;
      default:
        this.queueResponse(device.address);
    }
  }

  private queueResponse(
    targetMac: string,
    payload?: Uint8Array,
    delayMs = this.getDelayMs(
      demoState.state.get().transportDelays.commandExecutionMs,
    ),
    responseCode = DEMO_RESPONSE_CODE,
  ) {
    setTimeout(() => {
      this.emitFrame(responseCode, targetMac, payload);
    }, delayMs);
  }

  private handleAddDevice(payload: Uint8Array, targetMac: string) {
    // payload: [opcode 2B][hub-mac 6B LE][pod-mac 6B LE]
    if (payload.length < 14) {
      this.queueResponse(targetMac, undefined, undefined, DEMO_STATUS_INVALID_PARAM);
      return;
    }
    const podMacLE = this.bytesToHex(payload.slice(8, 14));
    const podMac = podMacLE.match(/.{2}/g)!.reverse().join(":").toUpperCase();
    const existing = demoState.state.get().list.entries;
    if (existing.some((e) => e.mac.toUpperCase() === podMac.toUpperCase())) {
      this.queueResponse(targetMac, undefined, undefined, DEMO_STATUS_INVALID_STATE);
      return;
    }
    demoState.addDeviceEntry({ mac: podMac, name: "NXS MTB Pod", deviceId: 10, isConnected: true, batteryVoltage: 3000, rssi: 178 });
    this.queueResponse(targetMac);
  }

  private handleRemoveDevice(payload: Uint8Array, targetMac: string) {
    // payload: [opcode 2B][hub-mac 6B LE][pod-mac 6B LE]
    if (payload.length < 14) {
      this.queueResponse(targetMac, undefined, undefined, DEMO_STATUS_INVALID_PARAM);
      return;
    }
    const podMacLE = this.bytesToHex(payload.slice(8, 14));
    const podMac = podMacLE.match(/.{2}/g)!.reverse().join(":").toUpperCase();
    demoState.removeDeviceEntry(podMac);
    this.queueResponse(targetMac);
  }

  private handleWriteButtonMap(payload: Uint8Array, targetMac: string) {
    // Two sub-command types: sub-opcode 0x00 = size header, 0x01 = entry
    // payload: [opcode 2B][hub-mac 6B LE][sub-opcode 1B][data...]
    if (payload.length < 9) {
      this.queueResponse(targetMac, undefined, undefined, DEMO_STATUS_INVALID_PARAM);
      return;
    }
    const subOpcode = payload[8];
    if (subOpcode === 0x00) {
      // size header — just ACK
      this.hub.clearButtonTable();
      this.queueResponse(targetMac);
      return;
    }
    if (subOpcode === 0x01) {
      // entry: [pod-mac 6B LE][hub-mac 6B LE][btn1 1B][btn2 1B][action 1B][fn 1B]
      if (payload.length < 25) {
        this.queueResponse(targetMac, undefined, undefined, DEMO_STATUS_INVALID_PARAM);
        return;
      }
      const podHex = this.bytesToHex(payload.slice(9, 15));
      const hubHex = this.bytesToHex(payload.slice(15, 21));
      const btn1 = payload[21].toString(16).padStart(2, "0").toUpperCase();
      const btn2 = payload[22].toString(16).padStart(2, "0").toUpperCase();
      const action = payload[23].toString(16).padStart(2, "0").toUpperCase();
      const fn = payload[24].toString(16).padStart(2, "0").toUpperCase();
      this.hub.appendButtonTableEntry({ podAddressHex: podHex, elinkAddressHex: hubHex, button1: { code: btn1, label: "" }, button2: { code: btn2, label: "" }, action: { code: action, label: "" }, function: { code: fn, label: "" } });
      this.queueResponse(targetMac);
      return;
    }
    this.queueResponse(targetMac, undefined, undefined, DEMO_STATUS_INVALID_PARAM);
  }

  private applyRename(payload: Uint8Array) {
    const rawName = payload.length > 8 ? payload.slice(8) : new Uint8Array();
    const decoded = new TextDecoder("utf-8")
      .decode(rawName)
      .replace(/\x00+$/, "");
    return this.hub.setDeviceName(decoded);
  }

  private queueNotify(
    code: number,
    targetMac: string,
    payload?: Uint8Array,
    delayMs = 0,
  ) {
    setTimeout(() => {
      this.emitFrame(code, targetMac, payload);
    }, delayMs);
  }

  private queueShiftComplete(targetMac: string, shift: DemoShiftComplete) {
    const payload = this.hexToBytes(shift.rawHex);
    this.queueNotify(DEMO_SHIFT_COMPLETE_CODE, targetMac, payload, 0);
  }

  private getDelayMs(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
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
    const mapBytes = this.hub.getButtonMapBytes();
    return this.reverseBytes(Uint8Array.from(mapBytes));
  }

  private buildButtonTablePayload() {
    const entries = this.hub.getButtonTable();
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
    return this.hub.getRearCogApproximateBytes();
  }

  private applyRearCogInfo(payload: Uint8Array) {
    const params = payload.slice(8);
    if (!params.length || params.length % 3 !== 0) return false;
    const offsets: number[] = [];
    const teeth: number[] = [];
    for (let index = 0; index < params.length; index += 3) {
      const offsetRaw =
        (params[index] & 0xff) | ((params[index + 1] & 0xff) << 8);
      offsets.push(offsetRaw / 10);
      teeth.push(params[index + 2] & 0xff);
    }
    return this.hub.setRearCogs(offsets, teeth);
  }

  private buildPositionPayload() {
    return this.hub.getPositionBytes();
  }

  private buildMotorParamsPayload() {
    return Uint8Array.from(this.hub.getMotorParamsBytes());
  }

  private startBatteryNotifications() {
    if (this.batteryTimer) return;
    this.emitBatterySample();
    this.batteryTimer = setInterval(() => {
      this.emitBatterySample();
    }, this.getDelayMs(demoState.state.get().transportDelays.batteryIntervalMs));
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
    const device = this.hub.getDevice();
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
    return this.hub.getDevice().mac || "";
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
    const podMac = this.getPodMac();
    if (!podMac) return;
    const buttonHex = buttonId.toString(16).padStart(2, "0").toUpperCase();
    const actionHex = actionFlag.toString(16).padStart(2, "0").toUpperCase();
    const buttonTable = this.hub.getButtonTable();
    const entry = buttonTable.find(
      (e) =>
        e.button1.code.toUpperCase() === buttonHex &&
        e.action.code.toUpperCase() === actionHex &&
        e.podAddressHex.toUpperCase() ===
        podMac.split(":").reverse().join("").toUpperCase(),
    );
    if (!entry) return;
    const fnCode = entry.function.code.toUpperCase();
    if (fnCode === "0A" || fnCode === "0B") {
      const direction = fnCode === "0A" ? "up" : "down";
      this.handleShift(this.getHubMac(), direction);
    } else if (fnCode === "11") {
      this.pod.toggleMode();
    }
  }

  private applyGearShift(direction: "up" | "down") {
    this.hub.applyGearShift(direction);
  }

  private applyTuneShift(direction: "up" | "down") {
    this.hub.applyTuneShift(direction, TUNE_STEP);
  }

  private applyAbsoluteMove(payload: Uint8Array) {
    const paramsOffset = 8;
    if (payload.length < paramsOffset + 2) return;
    const scaled = payload[paramsOffset] | (payload[paramsOffset + 1] << 8);
    const targetPosition = scaled / 10;
    this.hub.applyAbsoluteMove(targetPosition);
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
