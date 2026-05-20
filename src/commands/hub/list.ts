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
    result = await commands.getList();
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result.status !== "success") {
    die(`getList failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }
  const entries = result.entries ?? [];
  if (opts.json) {
    printJson(entries);
  } else {
    printLine(`${entries.length} paired device(s):`);
    for (const e of entries) {
      const connected = e.isConnected ? "●" : "○";
      const voltage = e.batteryVoltage !== undefined
        ? `${(e.batteryVoltage / 1000).toFixed(2)}V`
        : "---";
      printLine(`  ${connected} ${e.mac}  ${e.name.padEnd(20)}  ${voltage.padEnd(7)}  id:${e.deviceId}`);
    }
  }
}
