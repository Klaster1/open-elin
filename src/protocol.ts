export type BleWriteFn = (
  payload: Buffer,
  withoutResponse: boolean,
) => Promise<void>;

export type BleSubscribeFn = (handler: (data: Buffer) => void) => Promise<void>;

export interface ProtocolTransport {
  listDevices: () => Promise<TransportDevice[]>;
  connect: (device: TransportDevice) => Promise<TransportConnection>;
}

export interface TransportDevice {
  id: string;
  address: string;
  name: string;
  rssi: number;
  peripheral: any;
}

export interface TransportConnection {
  macAddress: string;
  writeWithoutResponse: boolean;
  writeMsg: BleWriteFn;
  writePin: BleWriteFn;
  subscribeMsg: BleSubscribeFn;
  subscribePin: BleSubscribeFn;
  disconnect: () => Promise<void>;
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
  private readonly responseTimeoutMs: number;
  private readonly pinCode?: string;
  private readonly sessions = new Map<
    string,
    {
      connection: TransportConnection;
      pending: {
        resolve: (data: Buffer) => void;
        reject: (err: Error) => void;
        timer: NodeJS.Timeout;
      } | null;
      peripheralWaiters: Array<{
        code: number;
        resolve: (data: Buffer) => void;
        reject: (err: Error) => void;
        timer: NodeJS.Timeout;
      }>;
      peripheralSubscriptions: Array<{
        code: number;
        handler: (data: Buffer) => void;
      }>;
    }
  >();

  constructor(
    transport: ProtocolTransport,
    options: {
      pinCode?: string;
      responseTimeoutMs?: number;
    },
  ) {
    this.transport = transport;
    this.responseTimeoutMs = options.responseTimeoutMs ?? 5000;
    this.pinCode = options.pinCode;
  }

  async listDevices() {
    return this.transport.listDevices();
  }

  async sendCommand(device: TransportDevice, payload: Buffer) {
    const session = await this.getSession(device);
    if (session.pending) {
      throw new Error("Command already in flight");
    }
    const response = new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        session.pending = null;
        reject(new Error("Response timeout"));
      }, this.responseTimeoutMs);
      session.pending = { resolve, reject, timer };
    });

    await session.connection.writeMsg(
      payload,
      session.connection.writeWithoutResponse,
    );
    return response;
  }

  async waitForPeripheralMessage(
    device: TransportDevice,
    code: number,
    timeoutMs?: number,
  ) {
    const session = await this.getSession(device);
    const waitMs = timeoutMs ?? this.responseTimeoutMs;
    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        session.peripheralWaiters = session.peripheralWaiters.filter(
          (w) => w.resolve !== resolve,
        );
        reject(new Error("Peripheral message timeout"));
      }, waitMs);
      session.peripheralWaiters.push({ code, resolve, reject, timer });
    });
  }

  async disconnect(device: TransportDevice) {
    const session = this.sessions.get(device.id);
    if (!session) return;
    await session.connection.disconnect();
    this.sessions.delete(device.id);
  }

  async subscribeToPeripheralMessage(
    device: TransportDevice,
    code: number,
    handler: (data: Buffer) => void,
  ) {
    const session = await this.getSession(device);
    const subscription = { code, handler };
    session.peripheralSubscriptions.push(subscription);
    return () => {
      session.peripheralSubscriptions = session.peripheralSubscriptions.filter(
        (s) => s !== subscription,
      );
    };
  }

  private async getSession(device: TransportDevice) {
    const existing = this.sessions.get(device.id);
    if (existing) return existing;

    const connection = await this.transport.connect(device);
    const session = {
      connection,
      pending: null as null | {
        resolve: (data: Buffer) => void;
        reject: (err: Error) => void;
        timer: NodeJS.Timeout;
      },
      peripheralWaiters: [] as Array<{
        code: number;
        resolve: (data: Buffer) => void;
        reject: (err: Error) => void;
        timer: NodeJS.Timeout;
      }>,
      peripheralSubscriptions: [] as Array<{
        code: number;
        handler: (data: Buffer) => void;
      }>,
    };

    await connection.subscribeMsg((data) => this.handleMsg(device.id, data));
    await connection.subscribePin((data) => {
      const hex = bufToHex(data).toLowerCase();
      if (hex === "01") {
        // PIN accepted
      }
    });

    if (this.pinCode) {
      const pinHex = processPin(this.pinCode);
      await connection.writePin(
        hexToBuffer(pinHex),
        connection.writeWithoutResponse,
      );
    }

    this.sessions.set(device.id, session);
    return session;
  }

  private handleMsg(deviceId: string, data: Buffer) {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    const code = responseCode(data);
    if (code < 0x8000) {
      session.peripheralSubscriptions
        .filter((s) => s.code === code)
        .forEach((s) => s.handler(data));
      const matching = session.peripheralWaiters.filter((w) => w.code === code);
      if (matching.length) {
        session.peripheralWaiters = session.peripheralWaiters.filter(
          (w) => w.code !== code,
        );
        matching.forEach((w) => {
          clearTimeout(w.timer);
          w.resolve(data);
        });
      }
    }
    if (!session.pending) return;
    if (code >= 0x8000 || code === 0x0008) {
      const pending = session.pending;
      clearTimeout(pending.timer);
      session.pending = null;
      pending.resolve(data);
    }
  }
}
