import process from "node:process";
import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printLine } from "../../output.ts";

export interface MonitorOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  deliver: string;
}

export async function run(opts: MonitorOpts): Promise<void> {
  let write: (line: string) => void;
  if (opts.deliver === "stdout") {
    write = (line) => process.stdout.write(line + "\n");
  } else if (opts.deliver.startsWith("file:")) {
    const fpath = opts.deliver.slice(5);
    const { createWriteStream } = await import("node:fs");
    const stream = createWriteStream(fpath, { flags: "a" });
    write = (line) => {
      stream.write(line + "\n");
    };
  } else {
    die(`invalid --deliver: "${opts.deliver}" (expected "stdout" or "file:<path>")`, ExitCode.InvalidArgs);
  }

  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });

  const emit = (event: string, data: unknown) => {
    write(JSON.stringify({ event, ...(data as object), ts: new Date().toISOString() }));
  };

  try {
    const unsub1 = await commands.subscribeToBatteryVoltage(
      (n) => emit("battery-voltage", n),
    );
    const unsub2 = await commands.subscribeToButtonAction(
      (n) => emit("button-action", n),
    );
    const unsub3 = await commands.subscribeToShiftComplete(
      (n) => emit("shift-complete", n),
    );

    if (opts.deliver === "stdout" && !opts.json) {
      printLine("Monitoring — press Ctrl-C to stop.");
    }

    const cleanup = async () => {
      unsub1();
      unsub2();
      unsub3();
      await protocol.disconnect(device).catch(() => {});
    };

    process.on("SIGINT", async () => {
      await cleanup();
      process.exit(ExitCode.Success);
    });

    process.on("SIGTERM", async () => {
      await cleanup();
      process.exit(ExitCode.Success);
    });

    // Keep alive indefinitely.
    await new Promise<never>(() => {});
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
}
