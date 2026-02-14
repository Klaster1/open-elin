import { BikeNetCommands } from "./commands.ts";
import { BikeNetProtocol } from "./protocol.ts";
import { NobleTransport } from "./transport-noble.ts";

async function main() {
  const transport = new NobleTransport({
    scanMs: 8000,
  });
  const protocol = new BikeNetProtocol(transport);

  const devices = await protocol.listDevices();
  if (!devices.length) {
    console.log("No devices found.");
    return;
  }

  const device = devices[0];

  try {
    const commands = new BikeNetCommands(protocol, device);
    let unsubscribeBattery: (() => void) | undefined;
    let unsubscribeButton: (() => void) | undefined;
    let unsubscribeShift: (() => void) | undefined;
    let unsubscribeButtonTable: (() => void) | undefined;

    process.on("SIGINT", async () => {
      unsubscribeBattery?.();
      unsubscribeButton?.();
      unsubscribeShift?.();
      unsubscribeButtonTable?.();
      await protocol.disconnect(device).catch(() => undefined);
      process.exit(0);
    });

    unsubscribeBattery = await commands.subscribeToBatteryVoltage((battery) => {
      if (battery.status !== "success") return;
      console.log("Battery notification:");
      console.log({
        targetMac: battery.targetMac,
        isHub: battery.isHub,
        batteryVoltage: battery.batteryVoltage,
        rawHex: battery.rawHex,
      });
    });

    unsubscribeButton = await commands.subscribeToButtonAction((action) => {
      if (action.status !== "success") return;
      console.log("Button action:");
      console.log({
        targetMac: action.targetMac,
        buttonId: action.buttonId,
        buttonHex: action.buttonHex,
        buttonLabel: action.buttonLabel,
        actionFlag: action.actionFlag,
        actionLabel: action.actionLabel,
        rawHex: action.rawHex,
      });
    });

    unsubscribeShift = await commands.subscribeToShiftComplete((shift) => {
      if (shift.status !== "success") return;
      console.log("Shift complete:");
      console.log({
        targetMac: shift.targetMac,
        payloadValue: shift.payloadValue,
        rawHex: shift.rawHex,
      });
    });

    unsubscribeButtonTable = await commands.subscribeToButtonTable((table) => {
      if (table.status !== "success") return;
      console.log("Button table notification:");
      const rows = (table.entries ?? []).map((e) => ({
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
      if (rows.length) console.table(rows);
    });

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

    // const renameResponse = await commands.setDeviceName("ELINK KLASTER");
    // console.log("Rename response:");
    // console.log(renameResponse);

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
    console.log("Listening for notifications. Press Ctrl+C to exit.");
    await new Promise<void>(() => undefined);
  } finally {
    await protocol.disconnect(device).catch(() => undefined);
  }
}

main()
  .then(() => undefined)
  .catch((err) => {
    console.error("Fatal error", err);
    process.exit(1);
  });
