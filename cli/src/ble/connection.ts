import { ProtocolCommands } from "lib/commands";
import type { TransportDevice } from "lib/protocol";
import { Protocol } from "lib/protocol";
import { ExitCode } from "../exit-codes.ts";
import { die } from "../output.ts";
import { NobleTransport } from "./transport-noble.ts";

export async function openHub(opts: {
  address: string;
  pin: string;
  timeoutMs: number;
}): Promise<{ protocol: Protocol; commands: ProtocolCommands; device: TransportDevice }> {
  const transport = new NobleTransport({ scanMs: opts.timeoutMs });
  const protocol = new Protocol(
    transport,
    { pinCode: opts.pin },
  );

  let devices: TransportDevice[];
  try {
    devices = (await protocol.listDevices()) as TransportDevice[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    die(`BLE adapter unavailable: ${msg}`, ExitCode.BleUnavailable);
  }

  const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-f]/g, "");
  const device = devices.find((d) => norm(d.address) === norm(opts.address));

  if (!device) {
    die(
      `hub ${opts.address} not found (scanned ${opts.timeoutMs}ms)`,
      ExitCode.HubNotFound,
    );
  }

  return { protocol, commands: new ProtocolCommands(protocol, device), device };
}
