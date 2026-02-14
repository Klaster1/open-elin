import type {
  ProtocolTransport,
  TransportConnection,
  TransportDevice,
} from "../protocol.ts";
import { hexToBuffer, reverseMacAddress } from "../protocol.ts";
import demoData from "./demo-data.json";

type DemoData = typeof demoData;

type MessageHandler = (data: Uint8Array) => void;

type DemoButtonEntry = DemoData["buttonTable"][number];

type DemoBatterySample = DemoData["batteryNotifications"][number];

type DemoShiftComplete = DemoData["shiftComplete"]["up"];

const DEMO_RESPONSE_CODE = 0x8000;
const DEMO_BATTERY_CODE = 0x4000;
const DEMO_BUTTON_TABLE_CODE = 0x4002;
const DEMO_SHIFT_COMPLETE_CODE = 0x4003;

const DEMO_BATTERY_INTERVAL_MS = 5000;

const DEMO_DEVICE: TransportDevice = {
  id: demoData.device.id || "demo-device",
  address: demoData.device.mac,
  name: demoData.device.name,
  rssi: demoData.device.rssi ?? 0,
  peripheral: null,
};

export class DemoTransport implements ProtocolTransport {
  private msgHandler: MessageHandler | null = null;
  private pinHandler: MessageHandler | null = null;
  private batteryTimer: ReturnType<typeof setInterval> | null = null;
  private batteryIndex = 0;

  async listDevices() {
    return [DEMO_DEVICE];
  }

  async connect(device: TransportDevice): Promise<TransportConnection> {
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
        this.queueResponse(device.address, this.buildButtonMapPayload());
        this.queueNotify(
          DEMO_BUTTON_TABLE_CODE,
          device.address,
          this.buildButtonTablePayload(),
          0,
        );
        return;
      case 0x001f:
        this.queueResponse(device.address, this.buildRearCogPayload());
        return;
      case 0x0013:
        this.queueResponse(device.address, this.buildPositionPayload());
        return;
      case 0x0010:
        this.queueResponse(device.address);
        this.queueShiftComplete(device.address, demoData.shiftComplete.up);
        return;
      case 0x0011:
        this.queueResponse(device.address);
        this.queueShiftComplete(device.address, demoData.shiftComplete.down);
        return;
      case 0x0017:
        this.queueResponse(device.address, this.buildMotorParamsPayload());
        return;
      case 0x0004:
      default:
        this.queueResponse(device.address);
    }
  }

  private queueResponse(targetMac: string, payload?: Uint8Array) {
    queueMicrotask(() => {
      this.emitFrame(DEMO_RESPONSE_CODE, targetMac, payload);
    });
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
    this.queueNotify(DEMO_SHIFT_COMPLETE_CODE, targetMac, payload);
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
    const entries = demoData.list.entries;
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
    const mapBytes = demoData.buttonMap.mapBytes;
    return this.reverseBytes(Uint8Array.from(mapBytes));
  }

  private buildButtonTablePayload() {
    const entries = demoData.buttonTable;
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
    const raw = Uint8Array.from(demoData.rearCogInfo.rawBytes);
    return this.reverseBytes(raw);
  }

  private buildPositionPayload() {
    return Uint8Array.from(demoData.position.rawBytes);
  }

  private buildMotorParamsPayload() {
    return Uint8Array.from(demoData.motorParams.rawBytes);
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
    const samples = demoData.batteryNotifications;
    if (!samples.length) return;
    const sample = samples[this.batteryIndex % samples.length];
    this.batteryIndex += 1;
    const payload = this.hexToBytes(sample.rawHex);
    this.emitFrame(DEMO_BATTERY_CODE, sample.targetMac, payload);
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
}

export type { DemoButtonEntry, DemoBatterySample, DemoShiftComplete };
