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
    const buttonMap = await commands.readButtonMap();
    console.log(buttonMap);
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
