import {
  BikeNetProtocol,
  hexToBuffer,
  reverseCommand,
  reverseMacAddress,
} from "./protocol.ts";

export interface GetListEntry {
  mac: string;
  name: string;
  type: number;
  flag: boolean;
  num: number;
  extra: number;
}

export interface GetListResponse {
  status: "success" | "error";
  code: number;
  targetMac?: string;
  entries?: GetListEntry[];
  raw: Buffer;
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
    const typeByte = payload[off + 22] & 0xff;
    const flag = (payload[off + 23] & 0xff) === 1;
    const num = ((payload[off + 25] & 0xff) << 8) | (payload[off + 24] & 0xff);
    const extra = payload[off + 26] & 0xff;
    entries.push({ mac, name, type: typeByte, flag, num, extra });
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
    return { status: "success", code, targetMac, entries, raw: data };
  }

  return { status: "error", code, targetMac, raw: data };
}

export class BikeNetCommands {
  private readonly protocol: BikeNetProtocol;

  constructor(protocol: BikeNetProtocol) {
    this.protocol = protocol;
  }

  async getList(): Promise<GetListResponse> {
    const payload = encodeGetList(this.protocol.getMacAddress());
    const response = await this.protocol.sendCommand(payload);
    return parseGetListResponse(response);
  }
}
