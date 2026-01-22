import { BikeNetCommands } from "./commands.ts";
import { BikeNetProtocol } from "./protocol.ts";
import { NobleTransport } from "./transport-noble.ts";

const PIN_CODE = "1111";

async function main() {
  const transport = new NobleTransport({
    scanMs: 8000,
  });
  const protocol = new BikeNetProtocol(transport, {
    pinCode: PIN_CODE,
    responseTimeoutMs: 8000,
  });

  const devices = await protocol.listDevices();
  if (!devices.length) {
    console.log("No devices found.");
    return;
  }

  const device = devices[0];

  try {
    const commands = new BikeNetCommands(protocol, device);
    const unsubscribeBattery = await commands.subscribeToBatteryVoltage(
      (battery) => {
        if (battery.status !== "success") return;
        console.log("Battery notification:");
        console.log({
          targetMac: battery.targetMac,
          isHub: battery.isHub,
          batteryVoltage: battery.batteryVoltage,
          rawHex: battery.rawHex,
        });
      },
    );

    const listResponse = await commands.getList();
    if (listResponse.status === "success" && listResponse.entries?.length) {
      console.log("Device list:");
      const listRows = listResponse.entries.map((entry, index) => ({
        index,
        mac: entry.mac,
        name: entry.name,
        deviceId: entry.deviceId,
        isConnected: entry.isConnected,
        batteryVoltage: entry.batteryVoltage,
        rssi: entry.rssi,
      }));
      console.table(listRows);
    } else {
      console.log(listResponse);
    }

    const motorParams = await commands.getMotorParams();
    if (motorParams.status === "success") {
      console.log("Motor params:");
      console.log(motorParams.humanReadable);
    } else {
      console.log(motorParams);
    }

    const rearCogInfo = await commands.getRearCogInfo();
    if (rearCogInfo.status === "success") {
      const values = rearCogInfo.values ?? [];
      console.log("Rear cog info:");
      if (values.length) {
        console.table(values.map((value, index) => ({ index, value })));
      }
    } else {
      console.log(rearCogInfo);
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
    unsubscribeBattery?.();
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
