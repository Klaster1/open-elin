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
    result = await commands.readButtonMap();
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});;
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result.status !== "success") {
    die(`readButtonMap failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }
  if (opts.json) {
    printJson({
      mapHex: result.mapHex,
      mapByteLength: result.mapByteLength,
      entryCount: result.entryCount,
      entries: result.entries,
    });
  } else {
    printLine(`mapHex:       ${result.mapHex ?? "—"}`);
    printLine(`mapByteLength:${result.mapByteLength ?? "—"}`);
    printLine(`entryCount:   ${result.entryCount ?? "—"}`);
    if (result.entries?.length) {
      for (const e of result.entries) {
        printLine(`  [${e.index}] pod:${e.podAddressHex} elink:${e.elinkAddressHex} btn1:${e.button1.code} btn2:${e.button2.code}`);
      }
    }
  }
}
