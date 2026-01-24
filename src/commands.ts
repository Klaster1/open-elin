import {
  BikeNetProtocol,
  hexToBuffer,
  reverseCommand,
  reverseMacAddress,
} from "./protocol.ts";
import type { TransportDevice } from "./protocol.ts";

export interface GetListEntry {
  mac: string;
  name: string;
  deviceId: number;
  isConnected: boolean;
  batteryVoltage: number;
  rssi: number;
}

export interface GetListResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  entries?: GetListEntry[];
}

export interface ReadButtonMapResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  mapHex?: string;
  mapBytes?: number[];
  mapByteLength?: number;
  entryCount?: number;
  entries?: ButtonMapEntry[];
}

export interface ButtonTableResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  entries?: ButtonMapEntry[];
}

export interface RearCogInfoResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  values?: number[];
  rawHex?: string;
  rawBytes?: number[];
}

export interface BasicResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
}

export interface MotorParamsResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  values?: number[];
  humanReadable?: MotorParamsReadable;
  rawHex?: string;
  rawBytes?: number[];
}

export interface MotorParamsReadable {
  stallDetection: number;
  pwmFrequency: number;
  accelRampTimer: number;
  rampStartDutyCycle: number;
  overshiftDistance: number;
  overshiftDelay: number;
  multishiftDelay: number;
}

export interface BatteryVoltageNotify {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  batteryVoltage?: number;
  isHub?: boolean;
  rawHex?: string;
  rawBytes?: number[];
}

export interface ButtonActionNotify {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  buttonId?: number;
  buttonHex?: string;
  buttonLabel?: string;
  actionFlag?: number;
  actionLabel?: string;
  rawHex?: string;
  rawBytes?: number[];
}

export interface ShiftCompleteNotify {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  payloadValue?: number;
  rawHex?: string;
  rawBytes?: number[];
}

export interface ButtonMapEntry {
  podAddressHex: string;
  elinkAddressHex: string;
  button1: { code: string; label?: string };
  button2: { code: string; label?: string };
  action: { code: string; label?: string };
  function: { code: string; label?: string };
  button1Label?: string;
  button2Label?: string;
  actionLabel?: string;
  functionLabel?: string;
  index: number;
}

const textDecoder = new TextDecoder("utf-8");
const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToHexUpper(bytes: Uint8Array) {
  return bytesToHex(bytes).toUpperCase();
}

function reverseBytes(bytes: Uint8Array) {
  const out = Uint8Array.from(bytes);
  out.reverse();
  return out;
}

function macFromBytes(bytes: Uint8Array) {
  const hex = bytesToHexUpper(reverseBytes(bytes));
  return hex.match(/.{1,2}/g)!.join(":");
}

function decodeName(bytes: Uint8Array) {
  return textDecoder.decode(bytes).replace(/\x00+$/, "");
}

function leInt(buf: Uint8Array, len: number) {
  let v = 0;
  for (let i = 0; i < len; i++) {
    v |= (buf[i] & 0xff) << (8 * i);
  }
  return v >>> 0;
}

function normalizeMac(mac?: string) {
  if (!mac) return "";
  const clean = mac.replace(/:/g, "").toUpperCase();
  if (clean.length !== 12) return mac.toUpperCase();
  return clean.match(/.{1,2}/g)!.join(":");
}

function encodeNameBytes(name: string) {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    if (i < name.length) {
      const bytes = textEncoder.encode(name.charAt(i));
      out[i] = bytes.length ? bytes[0] : 0x00;
    } else {
      out[i] = 0x00;
    }
  }
  return out;
}

function encodeGetList(mac: string) {
  const cmd = reverseCommand("0x0000");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function encodeSetName(mac: string, name: string) {
  const cmd = reverseCommand("0x0009");
  const revMac = reverseMacAddress(mac);
  const header = hexToBuffer(cmd + revMac);
  const nameBytes = encodeNameBytes(name);
  const out = new Uint8Array(header.length + nameBytes.length);
  out.set(header, 0);
  out.set(nameBytes, header.length);
  return out;
}

function parseGetListPayload(payload: Uint8Array): GetListEntry[] | null {
  if (!payload.length || payload.length % 27 !== 0) return null;
  const count = payload.length / 27;
  const entries: GetListEntry[] = [];
  for (let i = 0; i < count; i++) {
    const off = i * 27;
    const mac = macFromBytes(payload.slice(off, off + 6));
    const nameBuf = payload.slice(off + 6, off + 22);
    const name = decodeName(nameBuf);
    const deviceId = payload[off + 22] & 0xff;
    const isConnected = (payload[off + 23] & 0xff) === 1;
    const batteryVoltage =
      ((payload[off + 25] & 0xff) << 8) | (payload[off + 24] & 0xff);
    const rssi = payload[off + 26] & 0xff;
    entries.push({
      mac,
      name,
      deviceId,
      isConnected,
      batteryVoltage,
      rssi,
    });
  }
  return entries;
}

function parseGetListResponse(data: Uint8Array): GetListResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x8000) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const entries = parseGetListPayload(payload) || undefined;
    return { status: "success", code, targetMac, entries };
  }

  return { status: "error", code, targetMac };
}

function parseReadButtonMapResponse(data: Uint8Array): ReadButtonMapResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x8000) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const reversed = reverseBytes(payload);
    const mapHex = bytesToHexUpper(reversed);
    const mapBytes = Array.from(reversed.values());
    const mapByteLength = mapBytes.length;
    let entryCount: number | undefined;
    let entries: ButtonMapEntry[] | undefined;

    if (mapByteLength === 2) {
      const len = ((mapBytes[0] & 0xff) << 8) | (mapBytes[1] & 0xff);
      entryCount = len % 16 === 0 ? len / 16 : undefined;
      return {
        status: "success",
        code,
        targetMac,
        mapHex,
        mapBytes,
        mapByteLength: len,
        entryCount,
      };
    }

    if (mapByteLength % 16 === 0) {
      entries = parseButtonMapEntries(reversed);
      entryCount = entries.length;
    }

    return {
      status: "success",
      code,
      targetMac,
      mapHex,
      mapBytes,
      mapByteLength,
      entryCount,
      entries,
    };
  }

  return { status: "error", code, targetMac };
}

function parseRearCogInfoResponse(data: Uint8Array): RearCogInfoResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x8000) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const reversed = reverseBytes(payload);
    const rawHex = bytesToHexUpper(reversed);
    const rawBytes = Array.from(reversed.values());
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

    return { status: "success", code, targetMac, values, rawHex, rawBytes };
  }

  return { status: "error", code, targetMac };
}

function parseBasicResponse(data: Uint8Array): BasicResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;
  return { status: code === 0x8000 ? "success" : "error", code, targetMac };
}

function parseMotorParamsResponse(data: Uint8Array): MotorParamsResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x8000) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const rawHex = bytesToHexUpper(payload);
    const rawBytes = Array.from(payload.values());

    const sizes = [2, 4, 2, 1, 2, 2, 2];
    const values: number[] = [];
    let offset = 0;
    for (const size of sizes) {
      if (offset + size > payload.length) break;
      const slice = reverseBytes(payload.slice(offset, offset + size));
      const value = parseInt(bytesToHex(slice), 16);
      values.push(Number.isNaN(value) ? 0 : value);
      offset += size;
    }

    const humanReadable: MotorParamsReadable | undefined =
      values.length >= 7
        ? {
            stallDetection: values[0],
            pwmFrequency: values[1],
            accelRampTimer: values[2],
            rampStartDutyCycle: values[3],
            overshiftDistance: values[4] / 10,
            overshiftDelay: values[5],
            multishiftDelay: values[6],
          }
        : undefined;

    return {
      status: "success",
      code,
      targetMac,
      values,
      humanReadable,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

export function parseBatteryVoltageNotify(
  data: Uint8Array,
  hubMac?: string,
): BatteryVoltageNotify {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x4000) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const rawHex = bytesToHexUpper(payload);
    const rawBytes = Array.from(payload.values());
    const normalizedHub = normalizeMac(hubMac);
    const normalizedTarget = normalizeMac(targetMac);
    const isHub =
      normalizedHub.length > 0 && normalizedHub === normalizedTarget;
    const batteryVoltage = isHub
      ? parseInt(bytesToHex(reverseBytes(payload)), 16)
      : leInt(payload, Math.min(2, payload.length)) & 0xffff;

    return {
      status: "success",
      code,
      targetMac,
      batteryVoltage: Number.isNaN(batteryVoltage) ? undefined : batteryVoltage,
      isHub,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

export function parseButtonActionNotify(data: Uint8Array): ButtonActionNotify {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x4001) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const rawHex = bytesToHexUpper(payload);
    const rawBytes = Array.from(payload.values());
    const buttonId = payload.length > 0 ? payload[0] & 0xff : undefined;
    const actionFlag = payload.length > 1 ? payload[1] & 0xff : undefined;
    const buttonHex =
      buttonId === undefined
        ? undefined
        : buttonId.toString(16).padStart(2, "0").toUpperCase();
    const buttonLabel = buttonHex ? BUTTON_LABELS[buttonHex] : undefined;
    const actionHex =
      actionFlag === undefined
        ? undefined
        : actionFlag.toString(16).padStart(2, "0").toUpperCase();
    const actionLabel = actionHex ? ACTION_LABELS[actionHex] : undefined;

    return {
      status: "success",
      code,
      targetMac,
      buttonId,
      buttonHex,
      buttonLabel,
      actionFlag,
      actionLabel,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

export function parseShiftCompleteNotify(
  data: Uint8Array,
): ShiftCompleteNotify {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x4003) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const rawHex = bytesToHexUpper(payload);
    const rawBytes = Array.from(payload.values());
    const payloadValue = payload.length
      ? leInt(payload, Math.min(4, payload.length))
      : undefined;
    return {
      status: "success",
      code,
      targetMac,
      payloadValue,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

export class BikeNetCommands {
  private readonly protocol: BikeNetProtocol;
  private readonly device: TransportDevice;

  constructor(protocol: BikeNetProtocol, device: TransportDevice) {
    this.protocol = protocol;
    this.device = device;
  }

  async getList(): Promise<GetListResponse> {
    const payload = encodeGetList(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseGetListResponse(response);
  }

  async readButtonMap(): Promise<ReadButtonMapResponse> {
    const payload = encodeReadButtonMap(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseReadButtonMapResponse(response);
  }

  async readButtonTable(): Promise<ButtonTableResponse> {
    const payload = encodeReadButtonMap(this.device.address);
    await this.protocol.sendCommand(this.device, payload);
    const notify = await this.protocol.waitForPeripheralMessage(
      this.device,
      0x4002,
      8000,
    );
    return parseButtonTableNotify(notify);
  }

  async getRearCogInfo(): Promise<RearCogInfoResponse> {
    const payload = encodeGetRearCogInfo(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseRearCogInfoResponse(response);
  }

  async blinkLed(): Promise<BasicResponse> {
    const payload = encodeBlinkLed(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async setDeviceName(
    name: string,
    targetMac?: string,
  ): Promise<BasicResponse> {
    const mac = targetMac ?? this.device.address;
    const payload = encodeSetName(mac, name);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async shiftUp(): Promise<BasicResponse> {
    const payload = encodeShiftUp(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async shiftDown(): Promise<BasicResponse> {
    const payload = encodeShiftDown(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async getMotorParams(): Promise<MotorParamsResponse> {
    const payload = encodeGetMotorParams(this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseMotorParamsResponse(response);
  }

  async subscribeToBatteryVoltage(
    handler: (notify: BatteryVoltageNotify) => void,
  ) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      0x4000,
      (data) => handler(parseBatteryVoltageNotify(data, this.device.address)),
    );
  }

  async subscribeToButtonAction(handler: (notify: ButtonActionNotify) => void) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      0x4001,
      (data) => handler(parseButtonActionNotify(data)),
    );
  }

  async subscribeToShiftComplete(
    handler: (notify: ShiftCompleteNotify) => void,
  ) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      0x4003,
      (data) => handler(parseShiftCompleteNotify(data)),
    );
  }

  async subscribeToButtonTable(handler: (notify: ButtonTableResponse) => void) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      0x4002,
      (data) => handler(parseButtonTableNotify(data)),
    );
  }
}

function encodeReadButtonMap(mac: string) {
  const cmd = reverseCommand("0x0015");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function encodeGetRearCogInfo(mac: string) {
  const cmd = reverseCommand("0x001F");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function encodeBlinkLed(mac: string) {
  const cmd = reverseCommand("0x0004");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function encodeShiftUp(mac: string) {
  const cmd = reverseCommand("0x0010");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function encodeShiftDown(mac: string) {
  const cmd = reverseCommand("0x0011");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function encodeGetMotorParams(mac: string) {
  const cmd = reverseCommand("0x0017");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function parseButtonTableNotify(data: Uint8Array): ButtonTableResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === 0x4002) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const entries = payload.length >= 16 ? parseButtonMapEntries(payload) : [];
    return { status: "success", code, targetMac, entries };
  }

  return { status: "error", code, targetMac };
}

function parseButtonMapEntries(buf: Uint8Array): ButtonMapEntry[] {
  const entries: ButtonMapEntry[] = [];
  const count = Math.floor(buf.length / 16);
  for (let i = 0; i < count; i++) {
    const off = i * 16;
    const podAddressHex = bytesToHexUpper(buf.slice(off, off + 6));
    const elinkAddressHex = bytesToHexUpper(buf.slice(off + 6, off + 12));
    const button1 = bytesToHexUpper(buf.slice(off + 12, off + 13));
    const button2 = bytesToHexUpper(buf.slice(off + 13, off + 14));
    const action = bytesToHexUpper(buf.slice(off + 14, off + 15));
    const func = bytesToHexUpper(buf.slice(off + 15, off + 16));

    entries.push({
      podAddressHex,
      elinkAddressHex,
      button1: { code: button1, label: BUTTON_LABELS[button1] },
      button2: { code: button2, label: BUTTON_LABELS[button2] },
      action: { code: action, label: ACTION_LABELS[action] },
      function: { code: func, label: FUNCTION_LABELS[func] },
      button1Label: BUTTON_LABELS[button1],
      button2Label: BUTTON_LABELS[button2],
      actionLabel: ACTION_LABELS[action],
      functionLabel: FUNCTION_LABELS[func],
      index: i,
    });
  }
  return entries;
}

const ACTION_LABELS: Record<string, string> = {
  "00": "Press",
  "01": "Release",
  "02": "Double press",
};

const FUNCTION_LABELS: Record<string, string> = {
  "0A": "Shift Up",
  "0B": "Shift Down",
  "0C": "Toggle",
  "0D": "Seatpost Lock",
  "0E": "Seatpost Unlock",
  "0F": "Auto Up",
  "10": "Auto Down",
  "11": "Tune Mode",
};

const BUTTON_LABELS: Record<string, string> = {
  "00": "-",
  "01": "A-1",
  "02": "A-2",
  "03": "A-3",
  "04": "A-4",
  "05": "A-5",
  "06": "B",
  "07": "B-1",
  "08": "B-2",
  "09": "B-3",
  "0A": "B-4",
  "0B": "B-5",
  "0C": "C",
  "0D": "C-1",
  "0E": "C-2",
  "0F": "C-3",
  "10": "C-4",
  "11": "C-5",
  "12": "D",
  "13": "D-1",
  "14": "D-2",
  "15": "D-3",
  "16": "D-4",
  "17": "D-5",
};
