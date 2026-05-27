import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

export interface WriteDefaultButtonMapOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  podMac: string;
}

export async function run(opts: WriteDefaultButtonMapOpts): Promise<void> {
  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });
  let result;
  try {
    result = await commands.writeDefaultButtonMap(opts.podMac);
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
    return;
  }
  if (result!.status !== "success") {
    die(`writeDefaultButtonMap failed (code 0x${result!.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
    return;
  }
  if (opts.json) {
    printJson({ ok: true, podMac: opts.podMac });
  } else {
    printLine(`Wrote default button map for pod ${opts.podMac} to hub.`);
  }
}
