export interface NobleTransportOptions {
  scanMs?: number;
  onMsgNotify?: (data: Uint8Array) => void;
  onPinNotify?: (data: Uint8Array) => void;
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
  writeMsg: (payload: Uint8Array, withoutResponse: boolean) => Promise<void>;
  writePin: (payload: Uint8Array, withoutResponse: boolean) => Promise<void>;
  subscribeMsg: (handler: (data: Uint8Array) => void) => Promise<void>;
  subscribePin: (handler: (data: Uint8Array) => void) => Promise<void>;
  disconnect: () => Promise<void>;
}

export class NobleTransport {
  private readonly scanMs: number;
  private readonly onMsgNotify?: (data: Uint8Array) => void;
  private readonly onPinNotify?: (data: Uint8Array) => void;
  private readonly serviceUuid = "a5c1c000cc20ba910c1aef3f9e643d79";

  constructor(options: NobleTransportOptions) {
    this.scanMs = options.scanMs ?? 3000;
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
      const serviceUuids: string[] =
        peripheral.advertisement?.serviceUuids || [];
      const normalizedServiceUuids = serviceUuids.map((u) =>
        u.replace(/-/g, "").toLowerCase(),
      );
      const hasBikeNetService = normalizedServiceUuids.includes(
        this.serviceUuid,
      );
      const hasManufacturerData =
        (peripheral.advertisement?.manufacturerData?.length ?? 0) > 0;
      const rssi = peripheral.rssi ?? 0;

      if (!(hasBikeNetService && hasManufacturerData)) {
        return;
      }
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
    noble.default.startScanning([this.serviceUuid], true);

    await new Promise((resolve) => setTimeout(resolve, this.scanMs));

    noble.default.stopScanning();
    noble.default.removeListener("discover", handler);

    return Array.from(devices.values());
  }

  private readonly discoverTimeoutMs = 8000;
  private readonly retryDelayMs = 12000;
  private readonly maxConnectAttempts = 3;

  /** Connect + discoverServices with an 8 s timeout.  Throws on timeout so
   *  the caller can disconnect, wait for WinRT supervision timeout, and retry. */
  private async _tryConnect(peripheral: any): Promise<any[]> {
    await new Promise<void>((resolve, reject) => {
      peripheral.connect((err: Error | null) =>
        err ? reject(err) : resolve(),
      );
    });

    return await Promise.race([
      new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([], (err: Error | null, svcs: any[]) =>
          err ? reject(err) : resolve(svcs),
        );
      }),
      new Promise<any[]>((_, reject) =>
        setTimeout(
          () => reject(new Error("service-discovery timeout (WinRT cache)")),
          this.discoverTimeoutMs,
        ),
      ),
    ]);
  }

  async connect(device: TransportDevice): Promise<TransportConnection> {
    const peripheral = device.peripheral;
    let services: any[] | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxConnectAttempts; attempt++) {
      if (attempt > 0) {
        // Reset WinRT-cached BluetoothLEDevice and wait for supervision timeout
        process.stderr.write(
          `[noble] service-discovery failed (WinRT cache), retrying in ${this.retryDelayMs / 1000}s (attempt ${attempt + 1}/${this.maxConnectAttempts})\n`,
        );
        await new Promise<void>((resolve) =>
          peripheral.disconnect(() => resolve()),
        );
        await new Promise<void>((resolve) =>
          setTimeout(resolve, this.retryDelayMs),
        );
      }
      try {
        services = await this._tryConnect(peripheral);
        break;
      } catch (err) {
        lastError = err;
        if (
          !(err instanceof Error) ||
          !err.message.startsWith("service-discovery timeout")
        ) {
          throw err; // non-timeout errors: don't retry
        }
      }
    }

    if (!services) {
      throw lastError ?? new Error("service-discovery failed after retries");
    }

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
          const data = Buffer.isBuffer(payload)
            ? payload
            : Buffer.from(payload);
          msgChar.write(data, withoutResponse, (err: Error | null) =>
            err ? reject(err) : resolve(),
          );
        }),
      writePin: (payload, withoutResponse) =>
        new Promise<void>((resolve, reject) => {
          if (!pinChar) {
            resolve();
            return;
          }
          const data = Buffer.isBuffer(payload)
            ? payload
            : Buffer.from(payload);
          pinChar.write(data, withoutResponse, (err: Error | null) =>
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
            msgChar.on("data", (data: Uint8Array) => {
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
            pinChar.on("data", (data: Uint8Array) => {
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

  private async waitForPoweredOn(): Promise<void> {
    const noble = await import("@abandonware/noble");
    if (noble.default._state === "poweredOn") return;
    await new Promise<void>((resolve, reject) => {
      // Re-check inside the Promise constructor to close the TOCTOU window.
      if (noble.default._state === "poweredOn") {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        noble.default.removeListener("stateChange", handler);
        reject(
          new Error(
            `BLE adapter not ready after 10 s (state="${noble.default._state}")`,
          ),
        );
      }, 10000);
      const handler = (state: string) => {
        if (state === "poweredOn") {
          clearTimeout(timer);
          noble.default.removeListener("stateChange", handler);
          resolve();
        }
      };
      noble.default.on("stateChange", handler);
    });
  }
}
