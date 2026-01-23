export interface WebBluetoothTransportOptions {
  deviceNamePrefix?: string;
  optionalServiceUuids?: string[];
  onMsgNotify?: (data: Uint8Array) => void;
  onPinNotify?: (data: Uint8Array) => void;
}

export interface TransportDevice {
  id: string;
  address: string;
  name: string;
  rssi: number;
  peripheral: BluetoothDevice;
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

export class WebBluetoothTransport {
  private readonly onMsgNotify?: (data: Uint8Array) => void;
  private readonly onPinNotify?: (data: Uint8Array) => void;
  private readonly serviceUuid = "a5c1c000-cc20-ba91-0c1a-ef3f9e643d79";
  private readonly optionalServiceUuids?: string[];
  private readonly deviceNamePrefix?: string;

  constructor(options: WebBluetoothTransportOptions = {}) {
    this.onMsgNotify = options.onMsgNotify;
    this.onPinNotify = options.onPinNotify;
    this.optionalServiceUuids = options.optionalServiceUuids;
    this.deviceNamePrefix = options.deviceNamePrefix;
  }

  async listDevices(): Promise<TransportDevice[]> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser.");
    }

    const filters: BluetoothLEScanFilter[] = [{ services: [this.serviceUuid] }];
    if (this.deviceNamePrefix) {
      filters.push({ namePrefix: this.deviceNamePrefix });
    }

    const device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: [
        this.serviceUuid,
        ...(this.optionalServiceUuids ?? []),
      ],
    });

    return [
      {
        id: device.id,
        address: "",
        name: device.name ?? "",
        rssi: 0,
        peripheral: device,
      },
    ];
  }

  async connect(device: TransportDevice): Promise<TransportConnection> {
    const bluetoothDevice = device.peripheral;
    const server = await bluetoothDevice.gatt?.connect();
    if (!server) throw new Error("Unable to connect to GATT server.");

    const service = await server.getPrimaryService(this.serviceUuid);
    const MSG_UUID = "a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79";
    const PIN_UUID = "a5c1cc02-cc20-ba91-0c1a-ef3f9e643d79";

    const msgChar = await service.getCharacteristic(MSG_UUID);
    let pinChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      pinChar = await service.getCharacteristic(PIN_UUID);
    } catch {
      pinChar = null;
    }

    const writeWithoutResponse =
      "writeValueWithoutResponse" in msgChar &&
      typeof msgChar.writeValueWithoutResponse === "function";

    const toBuffer = (value: DataView) => {
      const { buffer, byteOffset, byteLength } = value;
      return new Uint8Array(buffer.slice(byteOffset, byteOffset + byteLength));
    };

    const toView = (payload: Uint8Array) => {
      const view = new Uint8Array(payload.byteLength);
      view.set(payload);
      return view;
    };

    return {
      macAddress: device.address,
      writeWithoutResponse,
      writeMsg: async (payload, withoutResponse) => {
        const view = toView(payload);
        if (withoutResponse && writeWithoutResponse) {
          await msgChar.writeValueWithoutResponse(view);
        } else {
          await msgChar.writeValue(view);
        }
      },
      writePin: async (payload, withoutResponse) => {
        if (!pinChar) return;
        const view = toView(payload);
        if (withoutResponse && "writeValueWithoutResponse" in pinChar) {
          await (pinChar as any).writeValueWithoutResponse(view);
        } else {
          await pinChar.writeValue(view);
        }
      },
      subscribeMsg: async (handler) => {
        await msgChar.startNotifications();
        msgChar.addEventListener("characteristicvaluechanged", (event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic)
            .value;
          if (!value) return;
          const data = toBuffer(value);
          if (this.onMsgNotify) this.onMsgNotify(data);
          handler(data);
        });
      },
      subscribePin: async (handler) => {
        if (!pinChar) return;
        await pinChar.startNotifications();
        pinChar.addEventListener("characteristicvaluechanged", (event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic)
            .value;
          if (!value) return;
          const data = toBuffer(value);
          if (this.onPinNotify) this.onPinNotify(data);
          handler(data);
        });
      },
      disconnect: async () => {
        bluetoothDevice.gatt?.disconnect();
      },
    };
  }
}
