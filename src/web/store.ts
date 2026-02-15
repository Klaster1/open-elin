import { Signal, computed, signal } from "@lit-labs/signals";

import { BikeNetCommands } from "../commands.ts";
import { BikeNetProtocol } from "../protocol.ts";
import type { ProtocolTransport } from "../protocol.ts";
import type { TransportDevice } from "../protocol.ts";
import { WebBluetoothTransport } from "./transport-web.ts";
import { DemoTransport } from "./transport-demo.ts";
import { demoState } from "./demo-state.ts";
import { PodMock } from "./pod-mock.ts";
import type { PodButtonActionEvent } from "./pod-mock.ts";

export type StatusKind = "wait" | "warn" | "ok";
export type Gear = {
  gearNumber: number;
  offsetApproximate: number;
  offsetPrecise: number | null;
  current: boolean;
};
export type Gears = Gear[];
type GearMap = Record<string, Gears>;

const connected = signal(false);
const connectEmpty = signal(false);
const mac = signal("");
const manualMac = signal("");
const adStatusText = signal("Listening for advertisements...");
const adStatusKind = signal<StatusKind>("wait");
const shiftStatusText = signal("Waiting for a shift-complete notification...");
const shiftStatusKind = signal<StatusKind>("wait");
const logLines = signal<string[]>([]);
const hubBatteryVoltage = signal<number | null>(null);
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
const demoMode = signal(false);
const gears = signal<GearMap>(readStoredGears());

const globalScope = globalThis as typeof globalThis & {
  __demoPod?: PodMock;
  __demoPodLogAttached?: boolean;
};

export const demoPod =
  globalScope.__demoPod ??
  new PodMock({
    batteryLevel: demoState.state.get().list.entries[0]?.batteryVoltage ?? 3000,
    podMac: demoState.state.get().list.entries[0]?.mac ?? "",
  });

globalScope.__demoPod = demoPod;

if (!globalScope.__demoPodLogAttached) {
  demoPod.addEventListener("pod-button-action", (event) => {
    if (!demoMode.get()) return;
    const detail = (event as CustomEvent<PodButtonActionEvent>).detail;
    if (!detail || detail.status !== "success") return;
    appendLog("Button action", {
      targetMac: detail.targetMac,
      buttonId: detail.buttonId,
      buttonLabel: detail.buttonLabel,
      actionLabel: detail.actionLabel,
      rawHex: detail.rawHex,
    });

    const direction = getDemoButtonDirection(detail.buttonId);
    if (!direction || detail.actionFlag === undefined) return;
    const mode = demoPod.state.get().mode;
    const shouldShift =
      (mode === "tune" && detail.actionFlag === 0) ||
      (mode === "shift" && detail.actionFlag === 1);
    if (!shouldShift) return;
    const shift = demoState.state.get().shiftComplete[direction];
    if (!shift) return;
    appendLog("Shift complete", {
      targetMac: demoState.state.get().device.mac,
      payloadValue: parseShiftCompleteValue(shift.rawHex),
      rawHex: shift.rawHex,
    });
  });
  globalScope.__demoPodLogAttached = true;
}

const demoPodBatteryLevel = computed(() => demoPod.state.get().batteryLevel);
const demoPodBatteryWatcher = new Signal.subtle.Watcher(() => {
  demoState.updatePodBatteryLevel(demoPodBatteryLevel.get());
});
demoPodBatteryWatcher.watch(demoPodBatteryLevel);
demoState.updatePodBatteryLevel(demoPodBatteryLevel.get());

const macStorageKey = "bikenetHubMac";
const gearsStorageKey = "bikenetGears";
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
  hubBatteryVoltage,
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
  demoMode,
  gears,
};

export const appActions = {
  initStoredMac,
  setPendingRouteMac,
  setShiftMacListener,
  setMacFromRoute,
  setManualMac,
  applyManualMac,
  connect,
  connectDemo,
  renameHub,
  getList,
  getMotorParams,
  getPosition,
  shiftUp,
  shiftDown,
  readButtonMap,
  readButtonTable,
  getRearCogInfo,
  ensureGearsForMac,
  refreshCurrentGear,
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
  const transport = new WebBluetoothTransport({
    deviceNamePrefix: "",
    onAdvertisementMac: (value) => {
      pendingAdvertMac = value;
      if (!connectedDevice.get()) return;
      setMac(value, "advertisements");
    },
  });
  await connectWithTransport(transport, {
    requestLabel: "Requesting device...",
    preferStoredMac: true,
    demo: false,
  });
}

export async function connectDemo() {
  const transport = new DemoTransport(demoPod);
  await connectWithTransport(transport, {
    requestLabel: "Starting demo transport...",
    preferStoredMac: false,
    demo: true,
  });
}

async function connectWithTransport(
  transport: ProtocolTransport,
  options: {
    requestLabel: string;
    preferStoredMac: boolean;
    demo: boolean;
  },
) {
  connectEmpty.set(false);
  connected.set(false);
  demoMode.set(options.demo);
  hubBatteryVoltage.set(null);
  pendingAdvertMac = null;
  appendLog(options.requestLabel);

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
    const storedMac = options.preferStoredMac ? readStoredMac() : "";
    const macFromAdvert = device.address;
    const macToUse = storedMac || macFromAdvert;

    if (macToUse) {
      setMac(macToUse, storedMac ? "stored" : "advertisements", {
        store: !options.demo,
      });
    } else {
      resetMacStatus();
      startAdTimer();
    }

    if (options.demo) {
      adStatusKind.set("ok");
      adStatusText.set("Demo data loaded.");
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
    if (battery.isHub) {
      hubBatteryVoltage.set(battery.batteryVoltage ?? null);
    }
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
    void refreshCurrentGear();
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

function setMac(
  value: string,
  source: string,
  options: { store?: boolean } = {},
) {
  const normalized = value.trim().toUpperCase();
  if (!isValidMac(normalized)) return false;
  if (macLockedByUser && source !== "manual entry") return false;

  const hadMac = Boolean(mac.get());
  mac.set(normalized);
  if (options.store !== false) {
    storeMac(normalized);
  }
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

function readStoredGears(): GearMap {
  try {
    const raw = localStorage.getItem(gearsStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    const result: GearMap = {};
    for (const [macKey, value] of entries) {
      if (!Array.isArray(value)) continue;
      const normalized = value
        .map((gear) => normalizeGear(gear))
        .filter((gear): gear is Gear => Boolean(gear));
      if (normalized.length) {
        result[macKey.toUpperCase()] = normalized;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function storeMac(value: string) {
  try {
    localStorage.setItem(macStorageKey, value);
  } catch {
    // Ignore storage failures.
  }
}

function storeGears(value: GearMap) {
  try {
    localStorage.setItem(gearsStorageKey, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

function normalizeGear(gear: unknown): Gear | null {
  if (!gear || typeof gear !== "object") return null;
  const value = gear as Partial<Gear>;
  if (typeof value.gearNumber !== "number") return null;
  if (typeof value.offsetApproximate !== "number") return null;
  const offsetPrecise =
    typeof value.offsetPrecise === "number" ? value.offsetPrecise : null;
  return {
    gearNumber: value.gearNumber,
    offsetApproximate: value.offsetApproximate,
    offsetPrecise,
    current: Boolean(value.current),
  };
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

function getActiveMacKey() {
  return (mac.get() || connectedDevice.get()?.address || "").toUpperCase();
}

function buildApproximateGears(values: number[]) {
  return values.map((value, index) => ({
    gearNumber: index + 1,
    offsetApproximate: value,
    offsetPrecise: null,
    current: false,
  }));
}

function setGearsForMac(macKey: string, nextGears: Gears) {
  if (!macKey) return;
  const normalized = macKey.toUpperCase();
  const next = { ...gears.get(), [normalized]: nextGears };
  gears.set(next);
  storeGears(next);
}

function updateApproximateGears(macKey: string, values?: number[]) {
  if (!macKey || !values?.length) return;
  const normalized = macKey.toUpperCase();
  const existing = gears.get()[normalized] ?? [];
  const existingByNumber = new Map(
    existing.map((gear) => [gear.gearNumber, gear]),
  );
  const updated = buildApproximateGears(values).map((gear) => {
    const prior = existingByNumber.get(gear.gearNumber);
    return prior
      ? {
          ...gear,
          offsetPrecise: prior.offsetPrecise,
          current: prior.current,
        }
      : gear;
  });
  setGearsForMac(normalized, updated);
}

function updatePreciseGear(
  macKey: string,
  currentGearNumber?: number,
  preciseOffset?: number | null,
) {
  if (!macKey || !currentGearNumber) return;
  const normalized = macKey.toUpperCase();
  const existing = gears.get()[normalized];
  if (!existing?.length) return;
  const updated = existing.map((gear) => {
    const isCurrent = gear.gearNumber === currentGearNumber;
    return {
      ...gear,
      current: isCurrent,
      offsetPrecise: isCurrent ? (preciseOffset ?? null) : gear.offsetPrecise,
    };
  });
  setGearsForMac(normalized, updated);
}

const DEMO_BUTTON_SHIFT_MAP: Record<number, "up" | "down"> = {
  1: "up",
  0: "down",
};

function getDemoButtonDirection(buttonId?: number) {
  if (buttonId === undefined) return undefined;
  return DEMO_BUTTON_SHIFT_MAP[buttonId];
}

function parseShiftCompleteValue(rawHex: string) {
  const bytes = hexToBytes(rawHex);
  let value = 0;
  for (let i = 0; i < Math.min(4, bytes.length); i += 1) {
    value |= (bytes[i] & 0xff) << (8 * i);
  }
  return value >>> 0;
}

function hexToBytes(hex: string) {
  const clean = hex.trim();
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  return bytes;
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
      updatePreciseGear(
        getActiveMacKey(),
        response.gearPosition,
        response.gearPosition ?? null,
      );
      appendLog("Position", {
        absolutePosition: response.absolutePosition,
        gearPosition: response.gearPosition,
      });
    }
    appendLog("Get position result", response ?? {});
    return response;
  } catch (err) {
    appendLog("Get position error", err instanceof Error ? err.message : err);
    return null;
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

export async function renameHub(name: string) {
  const deviceCommands = commands.get();
  const device = connectedDevice.get();
  if (!deviceCommands || !device) {
    appendLog("Connect to a hub first.");
    return null;
  }
  appendLog("Rename hub...", name);
  try {
    const response = await deviceCommands.setDeviceName(name, device.address);
    appendLog("Rename hub result", response ?? {});
    if (response.status === "success") {
      connectedDevice.set({ ...device, name });
    }
    return response;
  } catch (err) {
    appendLog("Rename hub error", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getRearCogInfo() {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  appendLog("Get rear cog info...");
  try {
    const response = await deviceCommands.getRearCogInfo();
    rearCogInfo.set(response ?? null);
    if (response?.status === "success") {
      updateApproximateGears(getActiveMacKey(), response.values);
    }
    appendLog("Get rear cog info result", response ?? {});
    return response;
  } catch (err) {
    appendLog(
      "Get rear cog info error",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function ensureGearsForMac(macKey: string) {
  if (!macKey) return;
  const normalized = macKey.toUpperCase();
  const existing = gears.get()[normalized];
  if (existing?.length) return;
  await getRearCogInfo();
  await getPosition();
}

export async function refreshCurrentGear() {
  const activeMac = getActiveMacKey();
  if (!activeMac) return;
  await getPosition();
}
