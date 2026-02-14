import { BikeNetCommands } from "../commands.ts";
import { BikeNetProtocol } from "../protocol.ts";
import { WebBluetoothTransport } from "./transport-web.ts";

const logArea = document.querySelector<HTMLPreElement>("#log");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const macInput = document.querySelector<HTMLInputElement>("#mac");
const listButton = document.querySelector<HTMLButtonElement>("#action-list");
const motorButton = document.querySelector<HTMLButtonElement>("#action-motor");
const mapButton = document.querySelector<HTMLButtonElement>("#action-map");
const tableButton = document.querySelector<HTMLButtonElement>("#action-table");
const cogsButton = document.querySelector<HTMLButtonElement>("#action-cogs");

if (
  !logArea ||
  !connectButton ||
  !macInput ||
  !listButton ||
  !motorButton ||
  !mapButton ||
  !tableButton ||
  !cogsButton
) {
  throw new Error("Missing UI elements");
}

let commands: BikeNetCommands | null = null;

const actionButtons = [
  listButton,
  motorButton,
  mapButton,
  tableButton,
  cogsButton,
];

const setActionsEnabled = (enabled: boolean) => {
  actionButtons.forEach((button) => {
    button.disabled = !enabled;
  });
};

function log(...parts: Array<string | number | object>) {
  const line = parts
    .map((p) => (typeof p === "string" ? p : JSON.stringify(p, null, 2)))
    .join(" ");
  logArea.textContent += `${line}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

async function connectAndRun() {
  connectButton.disabled = true;
  setActionsEnabled(false);
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

  const deviceCommands = new BikeNetCommands(protocol, device);
  commands = deviceCommands;
  setActionsEnabled(true);

  await deviceCommands.subscribeToBatteryVoltage((battery) => {
    if (battery.status !== "success") return;
    log("Battery notification", {
      targetMac: battery.targetMac,
      batteryVoltage: battery.batteryVoltage,
      rawHex: battery.rawHex,
    });
  });

  await deviceCommands.subscribeToButtonAction((action) => {
    if (action.status !== "success") return;
    log("Button action", {
      targetMac: action.targetMac,
      buttonId: action.buttonId,
      buttonLabel: action.buttonLabel,
      actionLabel: action.actionLabel,
      rawHex: action.rawHex,
    });
  });

  await deviceCommands.subscribeToShiftComplete((shift) => {
    if (shift.status !== "success") return;
    log("Shift complete", {
      targetMac: shift.targetMac,
      payloadValue: shift.payloadValue,
      rawHex: shift.rawHex,
    });
  });

  log("Connected. Use the read-only actions to query the hub.");
}

async function runAction<T>(label: string, action: () => Promise<T>) {
  if (!commands) {
    log("Connect to a hub first.");
    return;
  }
  try {
    log(label + "...");
    const result = await action();
    log(label + " result", result ?? {});
  } catch (err) {
    log(label + " error", err?.message ?? String(err));
  }
}

listButton.addEventListener("click", () => {
  runAction("Get list", async () => {
    const response = await commands!.getList();
    if (response.status === "success" && response.entries?.length) {
      response.entries.forEach((entry, index) => log({ index, ...entry }));
    }
    return response;
  });
});

motorButton.addEventListener("click", () => {
  runAction("Get motor params", async () => {
    const response = await commands!.getMotorParams();
    if (response.status === "success") {
      log("Motor params", response.humanReadable ?? {});
    }
    return response;
  });
});

mapButton.addEventListener("click", () => {
  runAction("Read button map", () => commands!.readButtonMap());
});

tableButton.addEventListener("click", () => {
  runAction("Read button table", () => commands!.readButtonTable());
});

cogsButton.addEventListener("click", () => {
  runAction("Get rear cog info", () => commands!.getRearCogInfo());
});

connectButton.addEventListener("click", () => {
  connectAndRun().catch((err) => {
    log("Fatal error", err?.message ?? String(err));
    console.error(err);
    connectButton.disabled = false;
    setActionsEnabled(false);
  });
});
