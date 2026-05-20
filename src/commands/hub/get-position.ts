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
  let result;
  try {
    result = await commands.getPosition();
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});;
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result.status !== "success") {
    die(`getPosition failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }
  if (opts.json) {
    printJson({
      absolutePosition: result.absolutePosition,
      gearPosition: result.gearPosition,
    });
  } else {
    printLine(`absolutePosition: ${result.absolutePosition ?? "—"}`);
    printLine(`gearPosition:     ${result.gearPosition ?? "—"}`);
  }
}
