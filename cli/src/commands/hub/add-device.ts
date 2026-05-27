import { openHub } from "../../ble/connection.ts";
import { ExitCode } from "../../exit-codes.ts";
import { die, printJson, printLine } from "../../output.ts";

const CON_TIMEOUT_CODE = 0x0008;
const POD_CONNECTED_NEW  = 0x8006;  // hub→ new pairing (first bond)
const POD_CONNECTED_RECONNECT = 0x8007;  // hub→ reconnect (existing bond)

export interface AddDeviceOpts {
  address: string;
  pin: string;
  timeout: number;
  json: boolean;
  podMac: string;
  waitForPod: number; // seconds to wait for pod-connected notification (0 = don't wait)
}

export async function run(opts: AddDeviceOpts): Promise<void> {
  const { protocol, commands, device } = await openHub({ address: opts.address, pin: opts.pin, timeoutMs: opts.timeout });
  let result;
  try {
    result = await commands.addDevice(opts.podMac);
  } catch (err) {
    await protocol.disconnect(device).catch(() => {});
    die(err instanceof Error ? err.message : String(err), ExitCode.CommandFailed);
  }
  if (result!.status !== "success") {
    await protocol.disconnect(device).catch(() => {});
    die(`addDevice failed (code 0x${result!.code.toString(16).toUpperCase()})`, ExitCode.CommandFailed);
  }

  if (opts.waitForPod > 0) {
    printLine(`add-device OK. Waiting up to ${opts.waitForPod}s for pod to connect...`);
    const waitMs = opts.waitForPod * 1000;

    // Log ALL raw hub notifications during wait (for diagnostics)
    const unsubRaw = await protocol.subscribeToRawMessages(device, (data) => {
      const code = (data[0] & 0xff) | ((data[1] & 0xff) << 8);
      process.stderr.write(`[RAW] code=0x${code.toString(16).padStart(4,"0")} hex=${Array.from(data).map(b=>b.toString(16).padStart(2,"0")).join("")}\n`);
    });

    // Race: pod connected (0x8006 new / 0x8007 reconnect) vs CON_TIMEOUT (0x0008) vs timeout
    const makePodConnected = (code: number) =>
      protocol.waitForPeripheralMessage(device, code, waitMs)
        .then((data) => ({ type: "pod_connected" as const, data }))
        .catch(() => ({ type: "timeout" as const, data: null as null }));
    const conTimeoutPromise = protocol.waitForPeripheralMessage(device, CON_TIMEOUT_CODE, waitMs)
      .then((data) => ({ type: "con_timeout" as const, data }))
      .catch(() => ({ type: "timeout" as const, data: null as null }));

    const first = await Promise.race([
      makePodConnected(POD_CONNECTED_NEW),
      makePodConnected(POD_CONNECTED_RECONNECT),
      conTimeoutPromise,
    ]);
    unsubRaw();
    await protocol.disconnect(device).catch(() => {});

    if (first.type === "pod_connected") {
      // data: [code 2B][hubMAC 6B][podMAC 6B]
      const podMacLE = first.data!.slice(8, 14);
      const podMacHex = Array.from(podMacLE).reverse().map(b => b.toString(16).padStart(2,"0")).join(":").toUpperCase();
      if (opts.json) {
        printJson({ ok: true, podMac: podMacHex, podConnected: true });
      } else {
        printLine(`Pod connected! MAC=${podMacHex}`);
      }
    } else if (first.type === "con_timeout") {
      if (opts.json) {
        printJson({ ok: false, podMac: opts.podMac, podConnected: false, reason: "CON_TIMEOUT" });
      } else {
        printLine(`CON_TIMEOUT: hub could not connect to pod. Is the pod powered on and advertising?`);
      }
      process.exit(ExitCode.CommandFailed);
    } else {
      if (opts.json) {
        printJson({ ok: true, podMac: opts.podMac, podConnected: false, reason: "no notification received" });
      } else {
        printLine(`No pod-connect notification received within ${opts.waitForPod}s. Hub may still be scanning.`);
      }
    }
  } else {
    await protocol.disconnect(device).catch(() => {});
    if (opts.json) {
      printJson({ ok: true, podMac: opts.podMac });
    } else {
      printLine(`Pod ${opts.podMac} added to hub.`);
    }
  }
}

