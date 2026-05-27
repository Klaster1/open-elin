import type { ButtonMapEntry } from "lib/commands";
import { buildDefaultButtonMap } from "lib/default-button-map";
import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

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
      entries = buildDefaultButtonMap(opts.podMac, opts.address);
    } else if (opts.useCaptured) {
      // --use-captured: build default map for the real captured hardware MACs
      entries = buildDefaultButtonMap("D5:89:B2:13:FA:04", "D7:BA:AB:52:A0:E5");
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
