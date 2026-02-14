import { BikeNetCommands } from "../commands.ts";
import { BikeNetProtocol } from "../protocol.ts";
import { WebBluetoothTransport } from "./transport-web.ts";

const logArea = document.querySelector<HTMLPreElement>("#log");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const macInput = document.querySelector<HTMLInputElement>("#mac");

if (!logArea || !connectButton || !macInput) {
  throw new Error("Missing UI elements");
}

function log(...parts: Array<string | number | object>) {
  const line = parts
    .map((p) => (typeof p === "string" ? p : JSON.stringify(p, null, 2)))
    .join(" ");
  logArea.textContent += `${line}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

async function connectAndRun() {
  connectButton.disabled = true;
  log("Requesting device...");

  const macOverride = macInput.value.trim().toUpperCase();
  const hasMacOverride = macOverride.length > 0;
  if (hasMacOverride && !/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(macOverride)) {
    log("Enter a valid hub MAC (AA:BB:CC:DD:EE:FF), or leave it blank.");
    connectButton.disabled = false;
    return;
  }

  const transport = new WebBluetoothTransport({
    deviceNamePrefix: "",
  });
  const protocol = new BikeNetProtocol(transport);

  const devices = await protocol.listDevices();
  if (!devices.length) {
    log("No devices found.");
    return;
  }

  const device = devices[0];
  const macFromAdvert = device.address;
  const macToUse = macOverride || macFromAdvert;
  if (!macToUse) {
    log("No hub MAC found in advertisements.");
    log("If commands fail, enter the hub MAC manually and try again.");
    connectButton.disabled = false;
    return;
  }
  if (!macOverride && macFromAdvert) {
    macInput.value = macFromAdvert;
  }
  device.address = macToUse;
  log("Selected device:", {
    id: device.id,
    name: device.name,
    mac: device.address,
  });

  const commands = new BikeNetCommands(protocol, device);

  await commands.subscribeToBatteryVoltage((battery) => {
    if (battery.status !== "success") return;
    log("Battery notification", {
      targetMac: battery.targetMac,
      batteryVoltage: battery.batteryVoltage,
      rawHex: battery.rawHex,
    });
  });

  await commands.subscribeToButtonAction((action) => {
    if (action.status !== "success") return;
    log("Button action", {
      targetMac: action.targetMac,
      buttonId: action.buttonId,
      buttonLabel: action.buttonLabel,
      actionLabel: action.actionLabel,
      rawHex: action.rawHex,
    });
  });

  await commands.subscribeToShiftComplete((shift) => {
    if (shift.status !== "success") return;
    log("Shift complete", {
      targetMac: shift.targetMac,
      payloadValue: shift.payloadValue,
      rawHex: shift.rawHex,
    });
  });

  const listResponse = await commands.getList();
  if (listResponse.status === "success" && listResponse.entries?.length) {
    log("Device list:");
    listResponse.entries.forEach((entry, index) => {
      log({ index, ...entry });
    });
  } else {
    log("List response", listResponse);
  }

  const motorParams = await commands.getMotorParams();
  if (motorParams.status === "success") {
    log("Motor params", motorParams.humanReadable ?? {});
  } else {
    log("Motor params error", motorParams);
  }

  log("Listening for notifications. Use the bike controls to trigger events.");
}

connectButton.addEventListener("click", () => {
  connectAndRun().catch((err) => {
    log("Fatal error", err?.message ?? String(err));
    console.error(err);
    connectButton.disabled = false;
  });
});
