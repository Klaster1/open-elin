export type BleWriteFn = (
  payload: Buffer,
  withoutResponse: boolean,
) => Promise<void>;

export type BleSubscribeFn = (handler: (data: Buffer) => void) => Promise<void>;

export interface ProtocolTransport {
  writeMsg: BleWriteFn;
  writePin: BleWriteFn;
  subscribeMsg: BleSubscribeFn;
  subscribePin: BleSubscribeFn;
}

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
  raw?: Buffer;
}

export function bufToHex(buf?: Buffer | null) {
  if (!buf) return "";
  return Buffer.from(buf).toString("hex");
}

export function hexToBuffer(hex: string) {
  return Buffer.from(hex, "hex");
}

export function reverseCommand(cmd: string) {
  const s = cmd.replace(/^0x/, "").padStart(4, "0");
  return s.substring(2, 4) + s.substring(0, 2);
}

export function reverseMacAddress(mac: string) {
  const clean = mac.replace(/:/g, "").toLowerCase();
  if (clean.length !== 12) return "";
  const bytes: string[] = [];
  for (let i = 0; i < 12; i += 2) bytes.push(clean.substring(i, i + 2));
  return bytes.reverse().join("");
}

export function processPin(pin: string) {
  return pin
    .split("")
    .map((d) => `0${d}`)
    .join("");
}

export function encodeGetList(mac: string) {
  const cmd = reverseCommand("0x0000");
  const revMac = reverseMacAddress(mac);
  return hexToBuffer(cmd + revMac);
}

export function parseGetListPayload(payload: Buffer): GetListEntry[] | null {
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

export function parseResponsePacket(data: Buffer): GetListResponse {
  const code = (data[0] & 0xff) | ((data[1] & 0xff) << 8);
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

export class BikeNetProtocol {
  private readonly transport: ProtocolTransport;

  constructor(transport: ProtocolTransport) {
    this.transport = transport;
  }

  async unlock(
    pin: string,
    writeWithoutResponse: boolean,
    onPinAck?: () => void,
  ) {
    await this.transport.subscribePin((data) => {
      const hex = bufToHex(data).toLowerCase();
      if (hex === "01" && onPinAck) onPinAck();
    });
    const pinHex = processPin(pin);
    await this.transport.writePin(hexToBuffer(pinHex), writeWithoutResponse);
  }

  async sendGetList(mac: string, writeWithoutResponse: boolean) {
    const payload = encodeGetList(mac);
    await this.transport.writeMsg(payload, writeWithoutResponse);
  }
}
