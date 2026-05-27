import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

export interface HubOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
}

export async function run(opts: HubOpts): Promise<void> {
  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });
  try {
    const result = await commands.powerDown();
    await protocol.disconnect(device).catch(() => {});
    if (result.status !== "success") {
      die(`powerDown failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
    }
  } catch {
    // Timeout / disconnect is expected — hub powers down before ACK
    await protocol.disconnect(device).catch(() => {});
  }
  if (opts.json) {
    printJson({ ok: true });
  } else {
    printLine("Hub powered down.");
  }
}
