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
    const listResponse = await commands.getList();
    if (listResponse.status === "success" && listResponse.entries?.length) {
      console.log("Device list:");
      const listRows = listResponse.entries.map((entry, index) => ({
        index,
        mac: entry.mac,
        name: entry.name,
        type: entry.type,
        flag: entry.flag,
        num: entry.num,
        extra: entry.extra,
      }));
      console.table(listRows);
    } else {
      console.log(listResponse);
    }
    const buttonTable = await commands.readButtonTable();
    if (buttonTable.status === "success" && buttonTable.entries?.length) {
      console.log("Button table entries:");
      const rows = buttonTable.entries.map((e) => ({
        index: e.index,
        pod: e.podAddressHex,
        elink: e.elinkAddressHex,
        button1Code: e.button1.code,
        button1Label: e.button1Label ?? "",
        button2Code: e.button2.code,
        button2Label: e.button2Label ?? "",
        actionCode: e.action.code,
        actionLabel: e.actionLabel ?? "",
        functionCode: e.function.code,
        functionLabel: e.functionLabel ?? "",
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
