import { BikeNetProtocol, parseResponsePacket } from "./protocol.ts";

export interface AppTransport {
  macAddress: string;
  writeWithoutResponse: boolean;
  onMsg: (handler: (data: Buffer) => void) => Promise<void>;
  onPin: (handler: (data: Buffer) => void) => Promise<void>;
  writeMsg: (payload: Buffer, withoutResponse: boolean) => Promise<void>;
  writePin: (payload: Buffer, withoutResponse: boolean) => Promise<void>;
}

export class BikeNetApp {
  private readonly protocol: BikeNetProtocol;
  private readonly transport: AppTransport;
  private lastGetList: any | null = null;

  constructor(transport: AppTransport) {
    this.transport = transport;
    this.protocol = new BikeNetProtocol({
      writeMsg: transport.writeMsg,
      writePin: transport.writePin,
      subscribeMsg: transport.onMsg,
      subscribePin: transport.onPin,
    });
  }

  async initAndUnlock(pin: string, onPinAck?: () => void) {
    await this.protocol.unlock(
      pin,
      this.transport.writeWithoutResponse,
      onPinAck,
    );
  }

  async getList() {
    await this.transport.onMsg((data) => {
      const parsed = parseResponsePacket(data);
      if (parsed.code === 0x8000) {
        this.lastGetList = parsed;
      }
    });
    await this.protocol.sendGetList(
      this.transport.macAddress,
      this.transport.writeWithoutResponse,
    );
  }

  getLastGetList() {
    return this.lastGetList;
  }
}
