import { BikeNetCommands } from "./commands.ts";
import { BikeNetProtocol } from "./protocol.ts";
import { NobleTransport } from "./transport-noble.ts";

const PIN_CODE = "1111";

async function main() {
  const transport = new NobleTransport({
    scanMs: 3000,
  });
  const protocol = new BikeNetProtocol(transport, {
    pinCode: PIN_CODE,
    responseTimeoutMs: 8000,
  });

  const devices = await protocol.listDevices();
  const device = devices.at(0);
  if (!device) {
    console.log("No devices found.");
    return;
  }

  console.log(device);

  try {
    const commands = new BikeNetCommands(protocol, device);
    const buttonTable = await commands.readButtonTable();
    if (buttonTable.status === "success" && buttonTable.entries?.length) {
      console.log("Button table entries:");
      const rows = buttonTable.entries.map((e) => ({
        index: e.index,
        pod: e.podAddressHex,
        elink: e.elinkAddressHex,
        button1: `${e.button1.code} ${e.button1Label ?? ""}`.trim(),
        button2: `${e.button2.code} ${e.button2Label ?? ""}`.trim(),
        action: `${e.action.code} ${e.actionLabel ?? ""}`.trim(),
        function: `${e.function.code} ${e.functionLabel ?? ""}`.trim(),
      }));
      console.table(rows);
    } else {
      console.log(buttonTable);
    }
  } finally {
    await protocol.disconnect(device).catch(() => undefined);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error", err);
    process.exit(1);
  });
