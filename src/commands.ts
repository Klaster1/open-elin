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

function leInt(buf: Buffer, len: number) {
  let v = 0;
  for (let i = 0; i < len; i++) {
    v |= (buf[i] & 0xff) << (8 * i);
  }
  return v >>> 0;
}

function encodeGetList(mac: string) {
  const cmd = reverseCommand("0x0000");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function parseGetListPayload(payload: Buffer): GetListEntry[] | null {
  if (!payload.length || payload.length % 27 !== 0) return null;
  const count = payload.length / 27;
  const entries: GetListEntry[] = [];
  for (let i = 0; i < count; i++) {
    const off = i * 27;
    const macPart = Buffer.from(payload.slice(off, off + 6));
    const mac = Buffer.from(macPart)
      .reverse()
      .toString("hex")
      .match(/.{1,2}/g)!
      .join(":")
      .toUpperCase();
    const nameBuf = Buffer.from(payload.slice(off + 6, off + 22));
    const name = nameBuf.toString("utf8").replace(/\x00+$/, "");
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

function parseGetListResponse(data: Buffer): GetListResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8
      ? Buffer.from(data.slice(2, 8))
          .reverse()
          .toString("hex")
          .match(/.{1,2}/g)!
          .join(":")
          .toUpperCase()
      : undefined;

  if (code === 0x8000) {
    const payload =
      data.length > 8 ? Buffer.from(data.slice(8)) : Buffer.alloc(0);
    const entries = parseGetListPayload(payload) || undefined;
    return { status: "success", code, targetMac, entries };
  }

  return { status: "error", code, targetMac };
}

function parseReadButtonMapResponse(data: Buffer): ReadButtonMapResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8
      ? Buffer.from(data.slice(2, 8))
          .reverse()
          .toString("hex")
          .match(/.{1,2}/g)!
          .join(":")
          .toUpperCase()
      : undefined;

  if (code === 0x8000) {
    const payload =
      data.length > 8 ? Buffer.from(data.slice(8)) : Buffer.alloc(0);
    const reversed = Buffer.from(payload).reverse();
    const mapHex = reversed.toString("hex").toUpperCase();
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
}

function encodeReadButtonMap(mac: string) {
  const cmd = reverseCommand("0x0015");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

function parseButtonTableNotify(data: Buffer): ButtonTableResponse {
  const code = leInt(data, 2) & 0xffff;
  const targetMac =
    data.length >= 8
      ? Buffer.from(data.slice(2, 8))
          .reverse()
          .toString("hex")
          .match(/.{1,2}/g)!
          .join(":")
          .toUpperCase()
      : undefined;

  if (code === 0x4002) {
    const payload =
      data.length > 8 ? Buffer.from(data.slice(8)) : Buffer.alloc(0);
    const entries = payload.length >= 16 ? parseButtonMapEntries(payload) : [];
    return { status: "success", code, targetMac, entries };
  }

  return { status: "error", code, targetMac };
}

function parseButtonMapEntries(buf: Buffer): ButtonMapEntry[] {
  const entries: ButtonMapEntry[] = [];
  const count = Math.floor(buf.length / 16);
  for (let i = 0; i < count; i++) {
    const off = i * 16;
    const podAddressHex = buf
      .slice(off, off + 6)
      .toString("hex")
      .toUpperCase();
    const elinkAddressHex = buf
      .slice(off + 6, off + 12)
      .toString("hex")
      .toUpperCase();
    const button1 = buf
      .slice(off + 12, off + 13)
      .toString("hex")
      .toUpperCase();
    const button2 = buf
      .slice(off + 13, off + 14)
      .toString("hex")
      .toUpperCase();
    const action = buf
      .slice(off + 14, off + 15)
      .toString("hex")
      .toUpperCase();
    const func = buf
      .slice(off + 15, off + 16)
      .toString("hex")
      .toUpperCase();

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
