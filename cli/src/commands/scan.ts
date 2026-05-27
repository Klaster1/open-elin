import { NobleTransport } from "../ble/transport-noble.ts";
import { ExitCode } from "../exit-codes.ts";
import { die, printJson, printLine } from "../output.ts";

export interface ScanOpts {
  timeout: number;
  limit: number | undefined;
  json: boolean;
}

export async function run(opts: ScanOpts): Promise<void> {
  const transport = new NobleTransport({ scanMs: opts.timeout });
  let devices = await transport.listDevices();

  if (devices.length === 0) {
    die(`no hubs found (scanned ${opts.timeout}ms)`, ExitCode.HubNotFound);
  }

  if (opts.limit !== undefined) {
    devices = devices.slice(0, opts.limit);
  }

  if (opts.json) {
    printJson(
      devices.map((d) => ({ address: d.address, name: d.name, rssi: d.rssi })),
    );
  } else {
    printLine(`Found ${devices.length} hub(s):`);
    for (const d of devices) {
      printLine(`  ${d.address}  ${d.name.padEnd(20)}  RSSI: ${d.rssi}`);
    }
  }
}
