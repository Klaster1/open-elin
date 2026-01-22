export interface NobleTransportOptions {
  scanMs?: number;
  nameFilter?: (name: string) => boolean;
  onMsgNotify?: (data: Buffer) => void;
  onPinNotify?: (data: Buffer) => void;
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
  writeMsg: (payload: Buffer, withoutResponse: boolean) => Promise<void>;
  writePin: (payload: Buffer, withoutResponse: boolean) => Promise<void>;
  subscribeMsg: (handler: (data: Buffer) => void) => Promise<void>;
  subscribePin: (handler: (data: Buffer) => void) => Promise<void>;
  disconnect: () => Promise<void>;
}

export class NobleTransport {
  private readonly scanMs: number;
  private readonly nameFilter: (name: string) => boolean;
  private readonly onMsgNotify?: (data: Buffer) => void;
  private readonly onPinNotify?: (data: Buffer) => void;

  constructor(options: NobleTransportOptions) {
    this.scanMs = options.scanMs ?? 3000;
    this.nameFilter =
      options.nameFilter ??
      ((name) =>
        name.includes("nxs shifter") ||
        name.includes("nxsshifter") ||
        name === "nxs shifter rr" ||
        name.includes("nxs"));
    this.onMsgNotify = options.onMsgNotify;
    this.onPinNotify = options.onPinNotify;
  }

  async listDevices(): Promise<TransportDevice[]> {
    await this.waitForPoweredOn();
    const devices = new Map<string, TransportDevice>();

    const handler = (peripheral: any) => {
      const id = (peripheral.id || peripheral.uuid || "<no-id>").toLowerCase();
      const address = (peripheral.address || "").toLowerCase();
      const name = (peripheral.advertisement?.localName || "").toLowerCase();
      const rssi = peripheral.rssi ?? 0;

      if (!this.nameFilter(name)) return;
      if (devices.has(id)) return;

      devices.set(id, {
        id,
        address,
        name,
        rssi,
        peripheral,
      });
    };

    const noble = await import("@abandonware/noble");
    noble.default.on("discover", handler);
    noble.default.startScanning([], true);

    await new Promise((resolve) => setTimeout(resolve, this.scanMs));

    noble.default.stopScanning();
    noble.default.removeListener("discover", handler);

    return Array.from(devices.values());
  }

  async connect(device: TransportDevice): Promise<TransportConnection> {
    const peripheral = device.peripheral;
    await new Promise<void>((resolve, reject) => {
      peripheral.connect((err: Error | null) =>
        err ? reject(err) : resolve(),
      );
    });

    const services = await new Promise<any[]>((resolve, reject) => {
      peripheral.discoverServices([], (err: Error | null, svcs: any[]) =>
        err ? reject(err) : resolve(svcs),
      );
    });

    const MSG_UUID = "a5c1cc01cc20ba910c1aef3f9e643d79";
    const PIN_UUID = "a5c1cc02cc20ba910c1aef3f9e643d79";
    let msgChar: any | null = null;
    let pinChar: any | null = null;

    await Promise.all(
      services.map(
        (s: any) =>
          new Promise<void>((resolve) => {
            s.discoverCharacteristics([], (err: Error | null, chars: any[]) => {
              if (!err) {
                chars.forEach((c: any) => {
                  const uuid = c.uuid.replace(/-/g, "").toLowerCase();
                  if (uuid === MSG_UUID) msgChar = c;
                  if (uuid === PIN_UUID) pinChar = c;
                });
              }
              resolve();
            });
          }),
      ),
    );

    if (!msgChar) {
      throw new Error("MSG characteristic not found");
    }

    const writeWithoutResponse = msgChar.properties.includes(
      "writeWithoutResponse",
    );

    return {
      macAddress: peripheral.address || device.address,
      writeWithoutResponse,
      writeMsg: (payload, withoutResponse) =>
        new Promise<void>((resolve, reject) => {
          msgChar.write(payload, withoutResponse, (err: Error | null) =>
            err ? reject(err) : resolve(),
          );
        }),
      writePin: (payload, withoutResponse) =>
        new Promise<void>((resolve, reject) => {
          if (!pinChar) {
            resolve();
            return;
          }
          pinChar.write(payload, withoutResponse, (err: Error | null) =>
            err ? reject(err) : resolve(),
          );
        }),
      subscribeMsg: (handler) =>
        new Promise<void>((resolve, reject) => {
          msgChar.subscribe((err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            msgChar.on("data", (data: Buffer) => {
              if (this.onMsgNotify) this.onMsgNotify(data);
              handler(data);
            });
            resolve();
          });
        }),
      subscribePin: (handler) =>
        new Promise<void>((resolve, reject) => {
          if (
            !pinChar ||
            (!pinChar.properties.includes("notify") &&
              !pinChar.properties.includes("indicate"))
          ) {
            resolve();
            return;
          }
          pinChar.subscribe((err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            pinChar.on("data", (data: Buffer) => {
              if (this.onPinNotify) this.onPinNotify(data);
              handler(data);
            });
            resolve();
          });
        }),
      disconnect: () =>
        new Promise<void>((resolve) => {
          peripheral.disconnect(() => resolve());
        }),
    };
  }

  private async waitForPoweredOn() {
    const noble = await import("@abandonware/noble");
    if (noble.default.state === "poweredOn") return;
    await new Promise<void>((resolve) => {
      const handler = (state: string) => {
        if (state === "poweredOn") {
          noble.default.removeListener("stateChange", handler);
          resolve();
        }
      };
      noble.default.on("stateChange", handler);
    });
  }
}
