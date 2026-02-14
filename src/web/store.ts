import { signal } from "@lit-labs/signals";

import { BikeNetCommands } from "../commands.ts";
import { BikeNetProtocol } from "../protocol.ts";
import type { TransportDevice } from "../protocol.ts";
import { WebBluetoothTransport } from "./transport-web.ts";

export type StatusKind = "wait" | "warn" | "ok";

const connected = signal(false);
const connectEmpty = signal(false);
const mac = signal("");
const manualMac = signal("");
const adStatusText = signal("Listening for advertisements...");
const adStatusKind = signal<StatusKind>("wait");
const shiftStatusText = signal("Waiting for a shift-complete notification...");
const shiftStatusKind = signal<StatusKind>("wait");
const logLines = signal<string[]>([]);
const listEntries = signal<any[]>([]);
const motorParams = signal<any | null>(null);
const position = signal<{
  absolutePosition?: number;
  gearPosition?: number;
} | null>(null);
const buttonMap = signal<any | null>(null);
const buttonTable = signal<any | null>(null);
const rearCogInfo = signal<any | null>(null);
const frontCogInfo = signal<any | null>(null);
const commands = signal<BikeNetCommands | null>(null);
const connectedDevice = signal<TransportDevice | null>(null);
const pendingRouteMac = signal("");

const macStorageKey = "bikenetHubMac";
let macLockedByUser = false;
let pendingAdvertMac: string | null = null;
let adTimeoutId: ReturnType<typeof setTimeout> | null = null;
let onShiftMac: ((mac: string) => void) | null = null;

export const appState = {
  connected,
  connectEmpty,
  mac,
  manualMac,
  adStatusText,
  adStatusKind,
  shiftStatusText,
  shiftStatusKind,
  logLines,
  listEntries,
  motorParams,
  position,
  buttonMap,
  buttonTable,
  rearCogInfo,
  frontCogInfo,
  commands,
  connectedDevice,
  pendingRouteMac,
};

export const appActions = {
  initStoredMac,
  setPendingRouteMac,
  setShiftMacListener,
  setMacFromRoute,
  setManualMac,
  applyManualMac,
  connect,
  getList,
  getMotorParams,
  getPosition,
  shiftUp,
  shiftDown,
  readButtonMap,
  readButtonTable,
  getRearCogInfo,
};

export function setShiftMacListener(
  listener: ((value: string) => void) | null,
) {
  onShiftMac = listener;
}

export function isValidMac(value: string) {
  return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(value);
}

export function initStoredMac() {
  const storedMac = readStoredMac();
  if (storedMac && isValidMac(storedMac) && !mac.get()) {
    setMac(storedMac, "stored");
  }
  return storedMac;
}

export function setPendingRouteMac(value: string) {
  pendingRouteMac.set(value);
}

export function setMacFromRoute(value: string) {
  return setMac(value, "route");
}

export function setManualMac(value: string) {
  manualMac.set(value.trim().toUpperCase());
}

export function applyManualMac() {
  const value = manualMac.get();
  if (!value) {
    appendLog("Enter a hub MAC to continue.");
    return;
  }
  if (!isValidMac(value)) {
    appendLog("Enter a valid hub MAC (AA:BB:CC:DD:EE:FF).");
    return;
  }
  macLockedByUser = true;
  setMac(value, "manual entry");
}

export async function connect() {
  connectEmpty.set(false);
  connected.set(false);
  appendLog("Requesting device...");

  const transport = new WebBluetoothTransport({
    deviceNamePrefix: "",
    onAdvertisementMac: (value) => {
      pendingAdvertMac = value;
      if (!connectedDevice.get()) return;
      setMac(value, "advertisements");
    },
  });
  const protocol = new BikeNetProtocol(transport);

  try {
    const devices = await protocol.listDevices();
    if (!devices.length) {
      connectEmpty.set(true);
      appendLog("No devices found.");
      return;
    }

    const device = devices[0];
    connectedDevice.set(device);
    const storedMac = readStoredMac();
    const macFromAdvert = device.address;
    const macToUse = storedMac || macFromAdvert;

    if (macToUse) {
      setMac(macToUse, storedMac ? "stored" : "advertisements");
    } else {
      resetMacStatus();
      startAdTimer();
    }

    device.address = mac.get() || "";
    appendLog("Selected device:", {
      id: device.id,
      name: device.name,
      mac: device.address || "(none)",
    });

    const deviceCommands = new BikeNetCommands(protocol, device);
    commands.set(deviceCommands);
    connected.set(true);

    if (pendingAdvertMac && !mac.get()) {
      setMac(pendingAdvertMac, "advertisements");
      pendingAdvertMac = null;
    }

    await subscribeNotifications(deviceCommands);
    appendLog("Connected. Use the actions to query the hub.");
  } catch (err) {
    connectEmpty.set(true);
    appendLog("No device was selected.");
    console.error(err);
  }
}

async function subscribeNotifications(deviceCommands: BikeNetCommands) {
  await deviceCommands.subscribeToBatteryVoltage((battery) => {
    if (battery.status !== "success") return;
    appendLog("Battery notification", {
      targetMac: battery.targetMac,
      batteryVoltage: battery.batteryVoltage,
      rawHex: battery.rawHex,
    });
  });

  await deviceCommands.subscribeToButtonAction((action) => {
    if (action.status !== "success") return;
    appendLog("Button action", {
      targetMac: action.targetMac,
      buttonId: action.buttonId,
      buttonLabel: action.buttonLabel,
      actionLabel: action.actionLabel,
      rawHex: action.rawHex,
    });
  });

  await deviceCommands.subscribeToShiftComplete((shift) => {
    if (shift.status !== "success") return;
    appendLog("Shift complete", {
      targetMac: shift.targetMac,
      payloadValue: shift.payloadValue,
      rawHex: shift.rawHex,
    });
    if (!mac.get() && shift.targetMac) {
      setMac(shift.targetMac, "shift-complete");
    }
  });

  await deviceCommands.subscribeToButtonTable((table) => {
    if (table.status !== "success") return;
    appendLog("Button table", {
      targetMac: table.targetMac,
      entries: table.entries ?? [],
    });
  });

  await deviceCommands.subscribeToFrontCog((frontCog) => {
    if (frontCog.status !== "success") return;
    frontCogInfo.set(frontCog);
    appendLog("Front cog", {
      targetMac: frontCog.targetMac,
      rawHex: frontCog.rawHex,
    });
  });
}

function setMac(value: string, source: string) {
  const normalized = value.trim().toUpperCase();
  if (!isValidMac(normalized)) return false;
  if (macLockedByUser && source !== "manual entry") return false;

  const hadMac = Boolean(mac.get());
  mac.set(normalized);
  storeMac(normalized);
  const device = connectedDevice.get();
  if (device) {
    device.address = normalized;
  }

  appendLog(`Hub MAC set from ${source}:`, normalized);
  if (source === "advertisements") {
    adStatusKind.set("ok");
    adStatusText.set("MAC discovered from advertisements.");
  }
  if (source === "shift-complete") {
    shiftStatusKind.set("ok");
    shiftStatusText.set("MAC captured from shift complete.");
    if (!hadMac && onShiftMac) {
      onShiftMac(normalized);
    }
  }
  if (source === "manual entry") {
    adStatusKind.set("warn");
    adStatusText.set("Manual MAC entry used.");
  }
  if (source === "stored") {
    adStatusKind.set("ok");
    adStatusText.set("MAC loaded from local storage.");
  }
  if (adTimeoutId) {
    clearTimeout(adTimeoutId);
    adTimeoutId = null;
  }
  return true;
}

function resetMacStatus() {
  adStatusKind.set("wait");
  adStatusText.set("Listening for advertisements...");
  shiftStatusKind.set("wait");
  shiftStatusText.set("Waiting for a shift-complete notification...");
}

function startAdTimer() {
  if (adTimeoutId) {
    clearTimeout(adTimeoutId);
    adTimeoutId = null;
  }
  adTimeoutId = setTimeout(() => {
    if (!mac.get()) {
      adStatusKind.set("warn");
      adStatusText.set("Couldn't discover MAC from advertisements yet.");
    }
  }, 10000);
}

function readStoredMac() {
  try {
    const value = localStorage.getItem(macStorageKey);
    return value ? value.trim().toUpperCase() : "";
  } catch {
    return "";
  }
}

function storeMac(value: string) {
  try {
    localStorage.setItem(macStorageKey, value);
  } catch {
    // Ignore storage failures.
  }
}

function appendLog(...parts: Array<string | number | object>) {
  const line = parts
    .map((part) =>
      typeof part === "string" ? part : JSON.stringify(part, null, 2),
    )
    .join(" ");
  const next = [...logLines.get(), line];
  logLines.set(next.slice(-400));
}

export async function getList() {
  const deviceCommands = commands.get();
  if (!deviceCommands) {
    appendLog("Connect to a hub first.");
    return;
  }
  appendLog("Get list...");
  try {
    const response = await deviceCommands.getList();
    if (response.status === "success" && response.entries?.length) {
      listEntries.set(response.entries);
      response.entries.forEach((entry, index) =>
        appendLog({ index, ...entry }),
      );
    }
    appendLog("Get list result", response ?? {});
  } catch (err) {
    appendLog("Get list error", err instanceof Error ? err.message : err);
  }
}

export async function getMotorParams() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Get motor params...");
  try {
    const response = await deviceCommands.getMotorParams();
    if (response.status === "success") {
      motorParams.set(response.humanReadable ?? response);
      appendLog("Motor params", response.humanReadable ?? {});
    }
    appendLog("Get motor params result", response ?? {});
  } catch (err) {
    appendLog(
      "Get motor params error",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getPosition() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Get position...");
  try {
    const response = await deviceCommands.getPosition();
    if (response.status === "success") {
      position.set({
        absolutePosition: response.absolutePosition,
        gearPosition: response.gearPosition,
      });
      appendLog("Position", {
        absolutePosition: response.absolutePosition,
        gearPosition: response.gearPosition,
      });
    }
    appendLog("Get position result", response ?? {});
  } catch (err) {
    appendLog("Get position error", err instanceof Error ? err.message : err);
  }
}

export async function shiftUp() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Shift up...");
  try {
    const response = await deviceCommands.shiftUp();
    appendLog("Shift up result", response ?? {});
  } catch (err) {
    appendLog("Shift up error", err instanceof Error ? err.message : err);
  }
}

export async function shiftDown() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Shift down...");
  try {
    const response = await deviceCommands.shiftDown();
    appendLog("Shift down result", response ?? {});
  } catch (err) {
    appendLog("Shift down error", err instanceof Error ? err.message : err);
  }
}

export async function readButtonMap() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Read button map...");
  try {
    const response = await deviceCommands.readButtonMap();
    buttonMap.set(response ?? null);
    appendLog("Read button map result", response ?? {});
  } catch (err) {
    appendLog(
      "Read button map error",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function readButtonTable() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Read button table...");
  try {
    const response = await deviceCommands.readButtonTable();
    if (response.status === "success") {
      buttonTable.set(response.entries ?? []);
    }
    appendLog("Read button table result", response ?? {});
  } catch (err) {
    appendLog(
      "Read button table error",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getRearCogInfo() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Get rear cog info...");
  try {
    const response = await deviceCommands.getRearCogInfo();
    rearCogInfo.set(response ?? null);
    appendLog("Get rear cog info result", response ?? {});
  } catch (err) {
    appendLog(
      "Get rear cog info error",
      err instanceof Error ? err.message : err,
    );
  }
}
