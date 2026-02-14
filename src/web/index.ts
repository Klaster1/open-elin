import { BikeNetCommands } from "../commands.ts";
import { BikeNetProtocol } from "../protocol.ts";
import type { TransportDevice } from "../protocol.ts";
import { WebBluetoothTransport } from "./transport-web.ts";

const logArea = document.querySelector<HTMLPreElement>("#log");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const connectEmpty = document.querySelector<HTMLDivElement>("#connect-empty");
const stepConnect = document.querySelector<HTMLElement>("#step-connect");
const stepMac = document.querySelector<HTMLElement>("#step-mac");
const stepReady = document.querySelector<HTMLElement>("#step-ready");
const adStatus = document.querySelector<HTMLDivElement>("#ad-status");
const shiftStatus = document.querySelector<HTMLDivElement>("#shift-status");
const macInput = document.querySelector<HTMLInputElement>("#mac");
const macApplyButton = document.querySelector<HTMLButtonElement>("#mac-apply");
const listButton = document.querySelector<HTMLButtonElement>("#action-list");
const motorButton = document.querySelector<HTMLButtonElement>("#action-motor");
const positionButton =
  document.querySelector<HTMLButtonElement>("#action-position");
const shiftUpButton =
  document.querySelector<HTMLButtonElement>("#action-shift-up");
const shiftDownButton =
  document.querySelector<HTMLButtonElement>("#action-shift-down");
const mapButton = document.querySelector<HTMLButtonElement>("#action-map");
const tableButton = document.querySelector<HTMLButtonElement>("#action-table");
const cogsButton = document.querySelector<HTMLButtonElement>("#action-cogs");

if (
  !logArea ||
  !connectButton ||
  !connectEmpty ||
  !stepConnect ||
  !stepMac ||
  !stepReady ||
  !adStatus ||
  !shiftStatus ||
  !macInput ||
  !macApplyButton ||
  !listButton ||
  !motorButton ||
  !positionButton ||
  !shiftUpButton ||
  !shiftDownButton ||
  !mapButton ||
  !tableButton ||
  !cogsButton
) {
  throw new Error("Missing UI elements");
}

let commands: BikeNetCommands | null = null;
let connectedDevice: TransportDevice | null = null;
let pendingAdvertMac: string | null = null;
let adTimeoutId: ReturnType<typeof setTimeout> | null = null;
let macLockedByUser = false;

const MAC_STORAGE_KEY = "bikenetHubMac";

type Step = "connect" | "mac" | "ready";

const setActionState = (connected: boolean, hasMac: boolean) => {
  listButton.disabled = !connected;
  const disableActions = !connected || !hasMac;
  [
    motorButton,
    positionButton,
    shiftUpButton,
    shiftDownButton,
    mapButton,
    tableButton,
    cogsButton,
  ].forEach((button) => {
    button.disabled = disableActions;
  });
};

const setStep = (step: Step) => {
  stepConnect.classList.toggle("active", step === "connect");
  stepMac.classList.toggle("active", step === "mac");
  stepReady.classList.toggle("active", step === "ready");
};

const setStatus = (
  element: HTMLDivElement,
  variant: "wait" | "warn" | "ok",
  text: string,
) => {
  element.textContent = text;
  element.classList.remove("wait", "warn", "ok");
  element.classList.add(variant);
};

const startAdTimer = () => {
  if (adTimeoutId) {
    clearTimeout(adTimeoutId);
    adTimeoutId = null;
  }
  adTimeoutId = setTimeout(() => {
    if (!connectedDevice?.address) {
      setStatus(
        adStatus,
        "warn",
        "Couldn't discover MAC from advertisements yet.",
      );
    }
  }, 10000);
};

const resetMacPaneStatus = () => {
  setStatus(adStatus, "wait", "Listening for advertisements...");
  setStatus(
    shiftStatus,
    "wait",
    "Waiting for a shift-complete notification...",
  );
};

const readStoredMac = () => {
  try {
    const value = localStorage.getItem(MAC_STORAGE_KEY);
    return value ? value.trim().toUpperCase() : "";
  } catch {
    return "";
  }
};

const storeMac = (mac: string) => {
  try {
    localStorage.setItem(MAC_STORAGE_KEY, mac);
  } catch {
    // Ignore storage failures.
  }
};

const setConnectEmpty = (show: boolean) => {
  connectEmpty.hidden = !show;
};

const normalizeMacInput = (value: string) => value.trim().toUpperCase();

const isValidMac = (value: string) =>
  /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(value);

const setMacIfAllowed = (mac: string, source: string) => {
  const normalized = normalizeMacInput(mac);
  if (!normalized || !isValidMac(normalized)) return false;
  if (!connectedDevice) return false;
  if (macLockedByUser && source !== "manual entry") return false;
  if (connectedDevice.address === normalized) return true;
  connectedDevice.address = normalized;
  macInput.value = normalized;
  storeMac(normalized);
  log(`Hub MAC set from ${source}:`, normalized);
  if (source === "advertisements") {
    setStatus(adStatus, "ok", "MAC discovered from advertisements.");
  }
  if (source === "shift-complete") {
    setStatus(shiftStatus, "ok", "MAC captured from shift complete.");
  }
  if (source === "manual entry") {
    setStatus(adStatus, "warn", "Manual MAC entry used.");
  }
  if (adTimeoutId) {
    clearTimeout(adTimeoutId);
    adTimeoutId = null;
  }
  setActionState(true, true);
  setStep("ready");
  return true;
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
  setActionState(false, false);
  setConnectEmpty(false);
  setStep("connect");
  log("Requesting device...");

  const macOverride = normalizeMacInput(macInput.value);
  const hasMacOverride = macOverride.length > 0;
  if (hasMacOverride && !isValidMac(macOverride)) {
    log("Enter a valid hub MAC (AA:BB:CC:DD:EE:FF), or leave it blank.");
    connectButton.disabled = false;
    return;
  }

  const transport = new WebBluetoothTransport({
    deviceNamePrefix: "",
    onAdvertisementMac: (mac) => {
      pendingAdvertMac = mac;
      if (!connectedDevice) return;
      setMacIfAllowed(mac, "advertisements");
    },
  });
  const protocol = new BikeNetProtocol(transport);

  try {
    const devices = await protocol.listDevices();
    if (!devices.length) {
      log("No devices found.");
      setConnectEmpty(true);
      connectButton.disabled = false;
      setStep("connect");
      return;
    }

    const device = devices[0];
    connectedDevice = device;
    const storedMac = hasMacOverride ? "" : readStoredMac();
    const macFromAdvert = device.address;
    const macToUse = macOverride || storedMac || macFromAdvert;
    macLockedByUser = hasMacOverride;
    if (!macOverride && macToUse) {
      macInput.value = macToUse;
    }
    device.address = macToUse ?? "";
    if (!macToUse) {
      resetMacPaneStatus();
      startAdTimer();
      log("No hub MAC available yet.");
      log("Waiting for advertisements or a shift-complete notification.");
    }
    log("Selected device:", {
      id: device.id,
      name: device.name,
      mac: device.address || "(none)",
    });

    const deviceCommands = new BikeNetCommands(protocol, device);
    commands = deviceCommands;
    setActionState(true, Boolean(macToUse));
    if (macToUse) {
      setStep("ready");
      storeMac(macToUse);
    } else {
      setStep("mac");
    }
    if (!macToUse && pendingAdvertMac) {
      setMacIfAllowed(pendingAdvertMac, "advertisements");
      pendingAdvertMac = null;
    }

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
      if (!connectedDevice?.address && shift.targetMac) {
        setMacIfAllowed(shift.targetMac, "shift-complete");
      }
    });

    await deviceCommands.subscribeToButtonTable((table) => {
      if (table.status !== "success") return;
      log("Button table", {
        targetMac: table.targetMac,
        entries: table.entries ?? [],
      });
    });

    await deviceCommands.subscribeToFrontCog((frontCog) => {
      if (frontCog.status !== "success") return;
      log("Front cog", {
        targetMac: frontCog.targetMac,
        rawHex: frontCog.rawHex,
      });
    });

    log("Connected. Use the actions to query the hub.");
  } catch (err) {
    log("No device was selected.");
    setConnectEmpty(true);
    connectButton.disabled = false;
    setActionState(false, false);
    setStep("connect");
    if (err instanceof Error) {
      console.error(err);
    }
  }
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

positionButton.addEventListener("click", () => {
  runAction("Get position", async () => {
    const response = await commands!.getPosition();
    if (response.status === "success") {
      log("Position", {
        absolutePosition: response.absolutePosition,
        gearPosition: response.gearPosition,
      });
    }
    return response;
  });
});

shiftUpButton.addEventListener("click", () => {
  runAction("Shift up", () => commands!.shiftUp());
});

shiftDownButton.addEventListener("click", () => {
  runAction("Shift down", () => commands!.shiftDown());
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
    setActionState(false, false);
    setStep("connect");
    setConnectEmpty(true);
  });
});

const applyManualMac = () => {
  if (!connectedDevice) return;
  const value = normalizeMacInput(macInput.value);
  if (!value) {
    log("Enter a hub MAC to continue.");
    return;
  }
  if (!isValidMac(value)) {
    log("Enter a valid hub MAC (AA:BB:CC:DD:EE:FF).");
    return;
  }
  macLockedByUser = true;
  setMacIfAllowed(value, "manual entry");
};

macApplyButton.addEventListener("click", applyManualMac);
macInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyManualMac();
});

setStep("connect");
setActionState(false, false);
