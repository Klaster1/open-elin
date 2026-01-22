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

function responseCode(data: Buffer) {
  return (data[0] & 0xff) | ((data[1] & 0xff) << 8);
}

export class BikeNetProtocol {
  private readonly transport: ProtocolTransport;
  private readonly macAddress: string;
  private readonly writeWithoutResponse: boolean;
  private readonly responseTimeoutMs: number;
  private pending: {
    resolve: (data: Buffer) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;

  constructor(
    transport: ProtocolTransport,
    options: {
      macAddress: string;
      writeWithoutResponse: boolean;
      responseTimeoutMs?: number;
    },
  ) {
    this.transport = transport;
    this.macAddress = options.macAddress;
    this.writeWithoutResponse = options.writeWithoutResponse;
    this.responseTimeoutMs = options.responseTimeoutMs ?? 5000;
  }

  getMacAddress() {
    return this.macAddress;
  }

  async connect(pinCode?: string, onPinAck?: () => void) {
    await this.transport.subscribeMsg((data) => this.handleMsg(data));
    await this.transport.subscribePin((data) => {
      const hex = bufToHex(data).toLowerCase();
      if (hex === "01" && onPinAck) onPinAck();
    });
    if (pinCode) {
      const pinHex = processPin(pinCode);
      await this.transport.writePin(
        hexToBuffer(pinHex),
        this.writeWithoutResponse,
      );
    }
  }

  async sendCommand(payload: Buffer) {
    if (this.pending) {
      throw new Error("Command already in flight");
    }
    const response = new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error("Response timeout"));
      }, this.responseTimeoutMs);
      this.pending = { resolve, reject, timer };
    });

    await this.transport.writeMsg(payload, this.writeWithoutResponse);
    return response;
  }

  private handleMsg(data: Buffer) {
    if (!this.pending) return;
    const code = responseCode(data);
    if (code >= 0x8000 || code === 0x0008) {
      const pending = this.pending;
      clearTimeout(pending.timer);
      this.pending = null;
      pending.resolve(data);
    }
  }
}
