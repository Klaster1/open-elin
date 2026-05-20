import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

export interface SetNameOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  name: string;
  targetMac: string | undefined;
}

export async function run(opts: SetNameOpts): Promise<void> {
  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });
  let result;
  try {
    result = await commands.setDeviceName(opts.name, opts.targetMac);
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});;
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result.status !== "success") {
    die(`setDeviceName failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }
  if (opts.json) {
    printJson({ ok: true });
  } else {
    const target = opts.targetMac ?? opts.address;
    printLine(`Device ${target} renamed to "${opts.name}".`);
  }
}
