import type { ButtonMapEntry } from "open-elin-lib/commands";
import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

// Captured from real pod D5:89:B2:13:FA:04 paired with hub D7:BA:AB:52:A0:E5
const CAPTURED_ENTRIES: ButtonMapEntry[] = [
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "00" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "0A" }, index: 0 },
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "06" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "0B" }, index: 1 },
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "0C" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "11" }, index: 2 },
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "0D" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "0A" }, index: 3 },
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "01" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "0B" }, index: 4 },
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "12" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "0B" }, index: 5 },
  { podAddressHex: "04FA13B289D5", elinkAddressHex: "E5A052ABBAD7", button1: { code: "02" }, button2: { code: "00" }, action: { code: "00" }, function: { code: "11" }, index: 6 },
];

function macToHexLE(mac: string): string {
  return mac.split(":").reverse().map((b) => b.toUpperCase()).join("");
}

export interface WriteButtonMapOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  entriesJson?: string;
  useCaptured?: boolean;
  podMac?: string;
}

export async function run(opts: WriteButtonMapOpts): Promise<void> {
  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });

  let entries: ButtonMapEntry[];
  let writeResult;
  try {
    if (opts.podMac) {
      const podHex = macToHexLE(opts.podMac);
      const hubHex = macToHexLE(opts.address);
      entries = CAPTURED_ENTRIES.map((e) => ({ ...e, podAddressHex: podHex, elinkAddressHex: hubHex }));
    } else if (opts.useCaptured) {
      entries = CAPTURED_ENTRIES;
    } else if (opts.entriesJson) {
      // Use entries supplied by caller (from --entries-json flag)
      entries = JSON.parse(opts.entriesJson) as ButtonMapEntry[];
      if (!entries.length) {
        await protocol.disconnect(device);
        die("--entries-json parsed to empty array", ExitCode.InvalidArgs);
        return;
      }
    } else {
      // Read button table from pod (hub forwards the request to paired pod)
      const tableResult = await commands.readButtonTable();
      if (tableResult.status !== "success" || !tableResult.entries?.length) {
        await protocol.disconnect(device);
        die(
          `readButtonTable failed or returned no entries (code 0x${tableResult.code.toString(16).toUpperCase()}) — is the pod paired and connected? Try --entries-json`,
          ExitCode.CommandFailed,
        );
        return;
      }
      entries = tableResult.entries;
    }

    // Write entries to the hub button map
    writeResult = await commands.writeButtonMap(entries);
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
    return;
  }

  if (writeResult!.status !== "success") {
    die(`writeButtonMap failed (code 0x${writeResult!.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }

  if (opts.json) {
    printJson({ written: entries!.length, entries });
  } else {
    printLine(`Wrote ${entries!.length} button map entries to hub.`);
    for (const e of entries!) {
      printLine(`  [${e.index}] pod:${e.podAddressHex} btn1:${e.button1.label ?? e.button1.code} btn2:${e.button2.label ?? e.button2.code} action:${e.action.label ?? e.action.code} fn:${e.function.label ?? e.function.code}`);
    }
  }
}
