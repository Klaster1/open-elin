export interface NobleTransportOptions {
  msgChar: any;
  pinChar: any | null;
  onMsgNotify?: (data: Buffer) => void;
  onPinNotify?: (data: Buffer) => void;
}

export class NobleTransport {
  private readonly msgChar: any;
  private readonly pinChar: any | null;
  private readonly onMsgNotify?: (data: Buffer) => void;
  private readonly onPinNotify?: (data: Buffer) => void;

  constructor(options: NobleTransportOptions) {
    this.msgChar = options.msgChar;
    this.pinChar = options.pinChar;
    this.onMsgNotify = options.onMsgNotify;
    this.onPinNotify = options.onPinNotify;
  }

  async writeMsg(payload: Buffer, withoutResponse: boolean) {
    await new Promise<void>((resolve, reject) => {
      this.msgChar.write(payload, withoutResponse, (err: Error | null) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async writePin(payload: Buffer, withoutResponse: boolean) {
    if (!this.pinChar) return;
    await new Promise<void>((resolve, reject) => {
      this.pinChar.write(payload, withoutResponse, (err: Error | null) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async subscribeMsg(handler: (data: Buffer) => void) {
    await new Promise<void>((resolve, reject) => {
      this.msgChar.subscribe((err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.msgChar.on("data", (data: Buffer) => {
          if (this.onMsgNotify) this.onMsgNotify(data);
          handler(data);
        });
        resolve();
      });
    });
  }

  async subscribePin(handler: (data: Buffer) => void) {
    if (!this.pinChar) return;
    if (
      !this.pinChar.properties.includes("notify") &&
      !this.pinChar.properties.includes("indicate")
    ) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.pinChar.subscribe((err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.pinChar.on("data", (data: Buffer) => {
          if (this.onPinNotify) this.onPinNotify(data);
          handler(data);
        });
        resolve();
      });
    });
  }
}
