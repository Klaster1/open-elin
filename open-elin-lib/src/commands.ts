import { buildDefaultButtonMap } from "./default-button-map.ts";
import type { TransportDevice } from "./protocol.ts";
import {
    Protocol,
    hexToBuffer,
    reverseCommand,
    reverseMacAddress,
} from "./protocol.ts";

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
  teeth?: number[];
  rawHex?: string;
  rawBytes?: number[];
}

export interface GetPositionResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  absolutePosition?: number;
  gearPosition?: number;
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

export interface FrontCogNotify {
  status: "success" | "error";
  code: number;
  targetMac?: string;
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

const AppCommand = {
  GetList: "0x0000",
  AddDevice: "0x0001",
  RemoveDevice: "0x0002",
  SetPin: "0x0003",
  BlinkLed: "0x0004",
  SetBikeNet: "0x0005",
  ResetBikeNet: "0x0006",
  DisconnectDevice: "0x0007",
  ReconnectDevice: "0x0008",
  SetName: "0x0009",
  Calibrate: "0x000B",
  CreateShiftTable: "0x000C",
  IncrementMove: "0x000D",
  AbsoluteMove: "0x000E",
  UpdatePosition: "0x000F",
  ShiftUp: "0x0010",
  ShiftDown: "0x0011",
  MoveToCog: "0x0012",
  GetPosition: "0x0013",
  WriteButtonMap: "0x0014",
  ReadButtonMap: "0x0015",
  SetMotorParams: "0x0016",
  GetMotorParams: "0x0017",
  MotorHome: "0x0019",
  SetRearCogInfo: "0x001D",
  GetRearCogInfo: "0x001F",
  SetTuningButtonLevel: "0x0022",
  ReadTuningButton: "0x0023",
  GetLastV: "0x0024",
  AppAction: "0xFFFF",
} as const;
type AppCommand = (typeof AppCommand)[keyof typeof AppCommand];

const PeripheralCommand = {
  BatteryVoltage: 0x4000,
  ButtonAction: 0x4001,
  ButtonTable: 0x4002,
  ShiftComplete: 0x4003,
  FrontCog: 0x4004,
} as const;
type PeripheralCommand = (typeof PeripheralCommand)[keyof typeof PeripheralCommand];

const ResponseCode = {
  Success: 0x8000,
} as const;
type ResponseCode = (typeof ResponseCode)[keyof typeof ResponseCode];

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

function buildRearCogParamsHex(cablePositions: number[], teeth?: number[]) {
  if (!cablePositions.length) {
    throw new Error("cablePositions must include at least one value");
  }

  if (teeth && teeth.length && teeth.length !== cablePositions.length) {
    throw new Error("teeth length must match cablePositions length");
  }

  const chunks: string[] = [];
  for (let i = 0; i < cablePositions.length; i++) {
    const raw = cablePositions[i] ?? 0;
    const cable = Math.trunc(raw * 10);
    const cableHex = cable.toString(16).padStart(4, "0");
    const cableLE = reverseCommand(cableHex);
    const toothValue = teeth?.[i] ?? 0;
    const toothHex = toothValue.toString(16).padStart(2, "0");
    chunks.push((cableLE + toothHex).toUpperCase());
  }
  return chunks.join("");
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

  if (code === ResponseCode.Success) {
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

  if (code === ResponseCode.Success) {
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

  if (code === ResponseCode.Success) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const reversed = reverseBytes(payload);
    const rawHex = bytesToHexUpper(reversed);
    const rawBytes = Array.from(reversed.values());
    const values: number[] = [];
    const teethValues: number[] = [];

    for (let i = 0; i + 2 < payload.length; i += 3) {
      const cableValue = leInt(payload.slice(i, i + 2), 2) / 10;
      if (!Number.isNaN(cableValue)) values.push(cableValue);
      teethValues.push(payload[i + 2] & 0xff);
    }

    const hasTeethData = teethValues.some((value) => value !== 0);

    return {
      status: "success",
      code,
      targetMac,
      values,
      teeth: hasTeethData ? teethValues : undefined,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

function parseGetPositionResponse(data: Uint8Array): GetPositionResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === ResponseCode.Success) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const rawHex = bytesToHexUpper(payload);
    const rawBytes = Array.from(payload.values());

    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    );
    const absolutePosition =
      payload.length >= 2 ? view.getUint16(0, true) / 10 : undefined;
    const gearHex =
      payload.length > 2 ? bytesToHex(payload.slice(2)) : undefined;
    const gearPosition = gearHex ? parseInt(gearHex, 16) + 1 : undefined;

    return {
      status: "success",
      code,
      targetMac,
      absolutePosition,
      gearPosition,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

function parseBasicResponse(data: Uint8Array): BasicResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;
  return {
    status: code === ResponseCode.Success ? "success" : "error",
    code,
    targetMac,
  };
}

function parseMotorParamsResponse(data: Uint8Array): MotorParamsResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === ResponseCode.Success) {
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

  if (code === PeripheralCommand.BatteryVoltage) {
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

  if (code === PeripheralCommand.ButtonAction) {
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

  if (code === PeripheralCommand.ShiftComplete) {
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

export function parseFrontCogNotify(data: Uint8Array): FrontCogNotify {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === PeripheralCommand.FrontCog) {
    const payload = data.length > 8 ? data.slice(8) : new Uint8Array();
    const rawHex = bytesToHexUpper(payload);
    const rawBytes = Array.from(payload.values());
    return {
      status: "success",
      code,
      targetMac,
      rawHex,
      rawBytes,
    };
  }

  return { status: "error", code, targetMac };
}

export class ProtocolCommands {
  private readonly protocol: Protocol;
  private readonly device: TransportDevice;

  constructor(protocol: Protocol, device: TransportDevice) {
    this.protocol = protocol;
    this.device = device;
  }

  async getList(): Promise<GetListResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.GetList,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseGetListResponse(response);
  }

  async readButtonMap(): Promise<ReadButtonMapResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.ReadButtonMap,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseReadButtonMapResponse(response);
  }

  async readButtonTable(): Promise<ButtonTableResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.ReadButtonMap,
      this.device.address,
    );
    await this.protocol.sendCommand(this.device, payload);
    const notify = await this.protocol.waitForPeripheralMessage(
      this.device,
      PeripheralCommand.ButtonTable,
      8000,
    );
    return parseButtonTableNotify(notify);
  }

  async writeButtonMap(entries: ButtonMapEntry[]): Promise<BasicResponse> {
    const cmd = reverseCommand(AppCommand.WriteButtonMap);
    const hubMacLE = reverseMacAddress(this.device.address);

    // Step 1: send size header — tells hub how many bytes of map data to expect
    const totalBytes = entries.length * 16;
    const sizeHex16 = totalBytes.toString(16).padStart(4, "0");
    const sizeBytesLE = sizeHex16.substring(2, 4) + sizeHex16.substring(0, 2);
    const sizePayload = hexToBuffer(cmd + hubMacLE + "00" + sizeBytesLE);
    const sizeResponse = await this.protocol.sendCommand(this.device, sizePayload);
    const sizeResult = parseBasicResponse(sizeResponse);
    if (sizeResult.status !== "success") return sizeResult;

    // Step 2: send each entry individually, waiting for ACK before the next
    for (const entry of entries) {
      const podMacLE = entry.podAddressHex.toLowerCase();
      const elinkMacLE = entry.elinkAddressHex.toLowerCase();
      const b1 = entry.button1.code.toLowerCase().padStart(2, "0");
      const b2 = entry.button2.code.toLowerCase().padStart(2, "0");
      const act = entry.action.code.toLowerCase().padStart(2, "0");
      const fn = entry.function.code.toLowerCase().padStart(2, "0");
      const entryPayload = hexToBuffer(
        cmd + hubMacLE + "01" + podMacLE + elinkMacLE + b1 + b2 + act + fn,
      );
      const entryResponse = await this.protocol.sendCommand(this.device, entryPayload);
      const entryResult = parseBasicResponse(entryResponse);
      if (entryResult.status !== "success") return entryResult;
    }

    return { status: "success", code: 0x8000 };
  }

  async getRearCogInfo(): Promise<RearCogInfoResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.GetRearCogInfo,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseRearCogInfoResponse(response);
  }

  async setRearCogInfo(
    cablePositions: number[],
    teeth?: number[],
  ): Promise<BasicResponse> {
    const header = encodeCommandWithMac(
      AppCommand.SetRearCogInfo,
      this.device.address,
    );
    const paramsHex = buildRearCogParamsHex(cablePositions, teeth);
    const params = hexToBuffer(paramsHex);
    const payload = new Uint8Array(header.length + params.length);
    payload.set(header, 0);
    payload.set(params, header.length);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async getPosition(): Promise<GetPositionResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.GetPosition,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseGetPositionResponse(response);
  }

  async setBikeNet(): Promise<BasicResponse> {
    const payload = encodeCommandWithMac(AppCommand.SetBikeNet, this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async calibrate(): Promise<BasicResponse> {
    const payload = encodeCommandWithMac(AppCommand.Calibrate, this.device.address);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async addDevice(podMac: string): Promise<BasicResponse> {
    const cmd = reverseCommand(AppCommand.AddDevice);
    const revHub = reverseMacAddress(this.device.address);
    const revPod = reverseMacAddress(podMac);
    const payload = hexToBuffer(cmd + revHub + revPod);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async removeDevice(podMac: string): Promise<BasicResponse> {
    const cmd = reverseCommand(AppCommand.RemoveDevice);
    const revHub = reverseMacAddress(this.device.address);
    const revPod = reverseMacAddress(podMac);
    const payload = hexToBuffer(cmd + revHub + revPod);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async disconnectDevice(podMac: string): Promise<BasicResponse> {
    const cmd = reverseCommand(AppCommand.DisconnectDevice);
    const revHub = reverseMacAddress(this.device.address);
    const revPod = reverseMacAddress(podMac);
    const payload = hexToBuffer(cmd + revHub + revPod);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async writeDefaultButtonMap(podMac: string): Promise<BasicResponse> {
    const entries = buildDefaultButtonMap(podMac, this.device.address);
    return this.writeButtonMap(entries);
  }

  async blinkLed(): Promise<BasicResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.BlinkLed,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async setDeviceName(
    name: string,
    targetMac?: string,
  ): Promise<BasicResponse> {
    const mac = targetMac ?? this.device.address;
    const header = encodeCommandWithMac(AppCommand.SetName, mac);
    const nameBytes = textEncoder.encode(name);
    const payload = new Uint8Array(header.length + nameBytes.length);
    payload.set(header, 0);
    payload.set(nameBytes, header.length);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async shiftUp(): Promise<BasicResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.ShiftUp,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async shiftDown(): Promise<BasicResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.ShiftDown,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async absoluteMove(targetPosition: number): Promise<BasicResponse> {
    const header = encodeCommandWithMac(
      AppCommand.AbsoluteMove,
      this.device.address,
    );
    const safeTarget = Number.isFinite(targetPosition) ? targetPosition : 0;
    const boundedTarget = Math.max(0, Math.min(6553.5, safeTarget));
    const scaled = Math.trunc(boundedTarget * 10);
    const params = new Uint8Array([scaled & 0xff, (scaled >> 8) & 0xff]);
    const payload = new Uint8Array(header.length + params.length);
    payload.set(header, 0);
    payload.set(params, header.length);
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseBasicResponse(response);
  }

  async getMotorParams(): Promise<MotorParamsResponse> {
    const payload = encodeCommandWithMac(
      AppCommand.GetMotorParams,
      this.device.address,
    );
    const response = await this.protocol.sendCommand(this.device, payload);
    return parseMotorParamsResponse(response);
  }

  async subscribeToBatteryVoltage(
    handler: (notify: BatteryVoltageNotify) => void,
  ) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      PeripheralCommand.BatteryVoltage,
      (data) => handler(parseBatteryVoltageNotify(data, this.device.address)),
    );
  }

  async subscribeToButtonAction(handler: (notify: ButtonActionNotify) => void) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      PeripheralCommand.ButtonAction,
      (data) => handler(parseButtonActionNotify(data)),
    );
  }

  async subscribeToShiftComplete(
    handler: (notify: ShiftCompleteNotify) => void,
  ) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      PeripheralCommand.ShiftComplete,
      (data) => handler(parseShiftCompleteNotify(data)),
    );
  }

  async subscribeToButtonTable(handler: (notify: ButtonTableResponse) => void) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      PeripheralCommand.ButtonTable,
      (data) => handler(parseButtonTableNotify(data)),
    );
  }

  async subscribeToFrontCog(handler: (notify: FrontCogNotify) => void) {
    return this.protocol.subscribeToPeripheralMessage(
      this.device,
      PeripheralCommand.FrontCog,
      (data) => handler(parseFrontCogNotify(data)),
    );
  }
}

function encodeCommandWithMac(command: AppCommand, mac: string) {
  const cmd = reverseCommand(command);
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function parseButtonTableNotify(data: Uint8Array): ButtonTableResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8 ? macFromBytes(data.slice(2, 8)) : undefined;

  if (code === PeripheralCommand.ButtonTable) {
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

export const ACTION_LABELS: Record<string, string> = {
  "00": "Press",
  "01": "Release",
  "02": "Double press",
};

export const FUNCTION_LABELS: Record<string, string> = {
  "0A": "Shift Up",
  "0B": "Shift Down",
  "0C": "Toggle",
  "0D": "Seatpost Lock",
  "0E": "Seatpost Unlock",
  "0F": "Auto Up",
  "10": "Auto Down",
  "11": "Tune Mode",
};

export const BUTTON_LABELS: Record<string, string> = {
  "00": "A",
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
