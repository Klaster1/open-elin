import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

export interface GetOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  mac: string;
}

export async function run(opts: GetOpts): Promise<void> {
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
  const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-f]/g, "");
  const entry = (result.entries ?? []).find((e) => norm(e.mac) === norm(opts.mac));
  if (!entry) {
    die(`device ${opts.mac} not found in paired list`, ExitCode.HubNotFound);
  }
  if (opts.json) {
    printJson(entry);
  } else {
    const connected = entry.isConnected ? "connected" : "disconnected";
    const voltage = entry.batteryVoltage !== undefined
      ? `${(entry.batteryVoltage / 1000).toFixed(2)}V`
      : "---";
    printLine(`${entry.mac}  ${entry.name}  ${connected}  ${voltage}  id:${entry.deviceId}`);
  }
}
