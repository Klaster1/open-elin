import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

export interface SetRearCogOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  positions: string;
  teeth: string | undefined;
}

export async function run(opts: SetRearCogOpts): Promise<void> {
  const posArr = opts.positions.split(",").map(Number);
  if (posArr.length === 0 || posArr.some((n) => isNaN(n))) {
    die(`invalid --positions value: "${opts.positions}"`, ExitCode.InvalidArgs);
  }

  let teethArr: number[] | undefined;
  if (opts.teeth !== undefined) {
    teethArr = opts.teeth.split(",").map(Number);
    if (teethArr.some((n) => isNaN(n))) {
      die(`invalid --teeth value: "${opts.teeth}"`, ExitCode.InvalidArgs);
    }
  }

  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });
  let result;
  try {
    result = await commands.setRearCogInfo(posArr, teethArr);
    await protocol.disconnect(device);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});;
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result.status !== "success") {
    die(`setRearCogInfo failed (code 0x${result.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }
  if (opts.json) {
    printJson({ ok: true });
  } else {
    printLine("Rear cog info updated.");
  }
}
