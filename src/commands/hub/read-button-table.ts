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
    result = await commands.readButtonTable();
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});;
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result.status !== "success") {
    die(`readButtonTable failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }
  const entries = result.entries ?? [];
  if (opts.json) {
    printJson({ entries });
  } else {
    printLine(`${entries.length} button table entry/entries:`);
    for (const e of entries) {
      printLine(`  [${e.index}] pod:${e.podAddressHex} elink:${e.elinkAddressHex} btn1:${e.button1.label ?? e.button1.code} btn2:${e.button2.label ?? e.button2.code} action:${e.action.label ?? e.action.code} fn:${e.function.label ?? e.function.code}`);
    }
  }
}
