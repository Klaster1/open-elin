import { Signal, computed, signal } from "@lit-labs/signals";

import { ProtocolCommands } from "open-elin-lib/commands";
import type { ProtocolTransport, TransportDevice } from "open-elin-lib/protocol";
import { Protocol } from "open-elin-lib/protocol";
import type { DemoState } from "./demo/demo-state.ts";
import { demoState } from "./demo/demo-state.ts";
import hubData from "./demo/hub-mock-data.json";
import {
  HUB_MOCK_MAX_OFFSET,
  HUB_MOCK_MIN_OFFSET,
  HubMock,
} from "./demo/hub-mock.ts";
import type { PodButtonActionEvent } from "./demo/pod-mock.ts";
import { PodMock } from "./demo/pod-mock.ts";
import { DemoTransport } from "./demo/transport-demo.ts";
import { WebBluetoothTransport } from "./transport-web.ts";

export type StatusKind = "wait" | "warn" | "ok";
export type Gear = {
  gearNumber: number;
  offsetApproximate: number;
  offsetPrecise: number | null;
  current: boolean;
  teeth: number | null;
};
export type Gears = Gear[];
type GearMap = Record<string, Gears>;
export type CogProfileEntry = {
  offset: number;
  toothCount: number;
};
export type CogProfile = {
  name: string;
  cogs: CogProfileEntry[];
};

type PositionState = {
  absolutePosition?: number;
  gearPosition?: number;
};

type StoreState = {
  connected: boolean;
  connectEmpty: boolean;
  mac: string;
  manualMac: string;
  adStatusText: string;
  adStatusKind: StatusKind;
  shiftStatusText: string;
  shiftStatusKind: StatusKind;
  logLines: string[];
  hubBatteryVoltage: number | null;
  listEntries: any[];
  motorParams: any | null;
  position: PositionState | null;
  buttonMap: any | null;
  buttonTable: any | null;
  rearCogInfo: any | null;
  frontCogInfo: any | null;
  commands: ProtocolCommands | null;
  connectedDevice: TransportDevice | null;
  pendingRouteMac: string;
  demoMode: boolean;
  gears: GearMap;
  cogProfiles: CogProfile[];
  cogsProfileWriteInProgress: boolean;
};

type StoreField<TValue> = {
  get: () => TValue;
  set: (next: TValue) => void;
};

const state = signal<StoreState>({
  connected: false,
  connectEmpty: false,
  mac: "",
  manualMac: "",
  adStatusText: "Listening for advertisements...",
  adStatusKind: "wait",
  shiftStatusText: "Waiting for a shift-complete notification...",
  shiftStatusKind: "wait",
  logLines: [],
  hubBatteryVoltage: null,
  listEntries: [],
  motorParams: null,
  position: null,
  buttonMap: null,
  buttonTable: null,
  rearCogInfo: null,
  frontCogInfo: null,
  commands: null,
  connectedDevice: null,
  pendingRouteMac: "",
  demoMode: false,
  gears: readStoredGears(),
  cogProfiles: readStoredCogProfiles(),
  cogsProfileWriteInProgress: false,
});

function field<TKey extends keyof StoreState>(
  key: TKey,
): StoreField<StoreState[TKey]> {
  return {
    get: () => state.get()[key],
    set: (next) => {
      const current = state.get();
      if (Object.is(current[key], next)) return;
      state.set({ ...current, [key]: next });
    },
  };
}

const connected = field("connected");
const connectEmpty = field("connectEmpty");
const mac = field("mac");
const manualMac = field("manualMac");
const adStatusText = field("adStatusText");
const adStatusKind = field("adStatusKind");
const shiftStatusText = field("shiftStatusText");
const shiftStatusKind = field("shiftStatusKind");
const logLines = field("logLines");
const hubBatteryVoltage = field("hubBatteryVoltage");
const listEntries = field("listEntries");
const motorParams = field("motorParams");
const position = field("position");
const buttonMap = field("buttonMap");
const buttonTable = field("buttonTable");
const rearCogInfo = field("rearCogInfo");
const frontCogInfo = field("frontCogInfo");
const commands = field("commands");
const connectedDevice = field("connectedDevice");
const pendingRouteMac = field("pendingRouteMac");
const demoMode = field("demoMode");
const gears = field("gears");
const cogProfiles = field("cogProfiles");
const cogsProfileWriteInProgress = field("cogsProfileWriteInProgress");

type DemoGlobals = {
  pod: PodMock;
  hub: HubMock;
  data: {
    state: {
      get: () => DemoState;
      set: (next: DemoState) => void;
    };
  };
};

const globalScope = globalThis as typeof globalThis & {
  __demo?: DemoGlobals;
  __demoPodLogAttached?: boolean;
};

function publishGlobalDemo(next: { pod: PodMock; hub: HubMock }) {
  globalScope.__demo = {
    pod: next.pod,
    hub: next.hub,
    data: demoState,
  };
}

export const demoPod =
  globalScope.__demo?.pod ??
  new PodMock({
    batteryLevel: demoState.state.get().list.entries[0]?.batteryVoltage ?? 3000,
    podMac: demoState.state.get().list.entries[0]?.mac ?? "",
  });

export const demoHub = globalScope.__demo?.hub ?? new HubMock();

publishGlobalDemo({ pod: demoPod, hub: demoHub });

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
      targetMac: hubData.device.mac,
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

const macStorageKey = "openElinHubMac";
const gearsStorageKey = "openElinGears";
const cogProfilesStorageKey = "openElinCogProfiles";
let macLockedByUser = false;
let pendingAdvertMac: string | null = null;
let adTimeoutId: ReturnType<typeof setTimeout> | null = null;
let onShiftMac: ((mac: string) => void) | null = null;
let currentActivePage = "log";

export type OffsetBounds = {
  min: number;
  max: number | null;
};

export function getOffsetBounds(): OffsetBounds {
  if (demoMode.get()) {
    return {
      min: HUB_MOCK_MIN_OFFSET,
      max: HUB_MOCK_MAX_OFFSET,
    };
  }

  return {
    min: 0,
    max: null,
  };
}

export function clampOffsetToBounds(value: number): number {
  const bounds = getOffsetBounds();
  const safeValue = Number.isFinite(value) ? value : bounds.min;
  const lowerBounded = Math.max(bounds.min, safeValue);
  if (bounds.max === null) return lowerBounded;
  return Math.min(bounds.max, lowerBounded);
}

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
  cogProfiles,
  cogsProfileWriteInProgress,
};

export const appActions = {
  initStoredMac,
  setActivePage,
  setPendingRouteMac,
  setShiftMacListener,
  setMacFromRoute,
  setManualMac,
  applyManualMac,
  clearStoredMac,
  connect,
  connectDemo,
  renameHub,
  getList,
  getMotorParams,
  getPosition,
  absoluteMove,
  shiftUp,
  shiftDown,
  readButtonMap,
  readButtonTable,
  getRearCogInfo,
  refreshCogsData,
  ensureGearsForMac,
  refreshCurrentGear,
  reloadCogProfiles,
  saveCurrentCogProfile,
  saveCogProfileFromEntries,
  renameCogProfile,
  removeCogProfile,
  applyCogProfile,
  writeSetupRearCogs,
};

export function setActivePage(page: string) {
  currentActivePage = page;
}

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

export function clearStoredMac() {
  try {
    localStorage.removeItem(macStorageKey);
  } catch {
    // Ignore storage failures.
  }
  macLockedByUser = false;
  manualMac.set("");
  mac.set("");
  pendingRouteMac.set("");
  connected.set(false);
  connectedDevice.set(null);
  commands.set(null);
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
    autoMacFromDevice: false,
  });
}

export async function connectDemo(options: { full?: boolean } = {}) {
  const full = Boolean(options.full);
  const pod = globalScope.__demo?.pod ?? demoPod;
  const hub = globalScope.__demo?.hub ?? new HubMock();
  publishGlobalDemo({ pod, hub });
  const transport = new DemoTransport(pod, hub);
  await connectWithTransport(transport, {
    requestLabel: "Starting demo transport...",
    preferStoredMac: false,
    demo: true,
    autoMacFromDevice: !full,
  });
}

async function connectWithTransport(
  transport: ProtocolTransport,
  options: {
    requestLabel: string;
    preferStoredMac: boolean;
    demo: boolean;
    autoMacFromDevice: boolean;
  },
) {
  connectEmpty.set(false);
  connected.set(false);
  demoMode.set(options.demo);
  hubBatteryVoltage.set(null);
  pendingAdvertMac = null;
  appendLog(options.requestLabel);

  const protocol = new Protocol(transport);

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
    const macFromAdvert = options.autoMacFromDevice ? device.address : "";
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

    const deviceCommands = new ProtocolCommands(protocol, device);
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

async function subscribeNotifications(deviceCommands: ProtocolCommands) {
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

function readStoredCogProfiles(): CogProfile[] {
  try {
    const raw = localStorage.getItem(cogProfilesStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((profile) => normalizeCogProfile(profile))
      .filter((profile): profile is CogProfile => Boolean(profile));
  } catch {
    return [];
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

function storeCogProfiles(value: CogProfile[]) {
  try {
    localStorage.setItem(cogProfilesStorageKey, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

function normalizeCogProfile(profile: unknown): CogProfile | null {
  if (!profile || typeof profile !== "object") return null;
  const value = profile as Partial<CogProfile> & {
    offsets?: unknown;
    teeth?: unknown;
  };
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;

  if (Array.isArray(value.cogs)) {
    const cogs = value.cogs.filter(
      (item): item is CogProfileEntry =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as CogProfileEntry).offset === "number" &&
        Number.isFinite((item as CogProfileEntry).offset) &&
        typeof (item as CogProfileEntry).toothCount === "number" &&
        Number.isFinite((item as CogProfileEntry).toothCount),
    );
    if (!cogs.length) return null;
    return {
      name,
      cogs,
    };
  }

  if (!Array.isArray(value.offsets) || !Array.isArray(value.teeth)) return null;
  const offsets = value.offsets.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
  const teeth = value.teeth.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
  if (!offsets.length || offsets.length !== teeth.length) return null;

  const cogs = offsets.map((offset, index) => ({
    offset,
    toothCount: teeth[index] ?? 0,
  }));
  return {
    name,
    cogs,
  };
}

function normalizeGear(gear: unknown): Gear | null {
  if (!gear || typeof gear !== "object") return null;
  const value = gear as Partial<Gear>;
  if (typeof value.gearNumber !== "number") return null;
  if (typeof value.offsetApproximate !== "number") return null;
  const offsetPrecise =
    typeof value.offsetPrecise === "number" ? value.offsetPrecise : null;
  const teeth = typeof value.teeth === "number" ? value.teeth : null;
  return {
    gearNumber: value.gearNumber,
    offsetApproximate: value.offsetApproximate,
    offsetPrecise,
    current: Boolean(value.current),
    teeth,
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

function buildApproximateGears(values: number[], teeth?: number[]) {
  return values.map((value, index) => ({
    gearNumber: index + 1,
    offsetApproximate: value,
    offsetPrecise: null,
    current: false,
    teeth: typeof teeth?.[index] === "number" ? teeth[index] : null,
  }));
}

function setGearsForMac(macKey: string, nextGears: Gears) {
  if (!macKey) return;
  const normalized = macKey.toUpperCase();
  const next = { ...gears.get(), [normalized]: nextGears };
  gears.set(next);
  storeGears(next);
}

function setCogProfiles(nextProfiles: CogProfile[]) {
  cogProfiles.set(nextProfiles);
  storeCogProfiles(nextProfiles);
}

function updateApproximateGears(
  macKey: string,
  values?: number[],
  teeth?: number[],
) {
  if (!macKey || !values?.length) return;
  const normalized = macKey.toUpperCase();
  const existing = gears.get()[normalized] ?? [];
  const existingByNumber = new Map(
    existing.map((gear) => [gear.gearNumber, gear]),
  );
  const updated = buildApproximateGears(values, teeth).map((gear) => {
    const prior = existingByNumber.get(gear.gearNumber);
    const mergedTeeth = teeth ? gear.teeth : (prior?.teeth ?? gear.teeth);
    return prior
      ? {
          ...gear,
          offsetPrecise: prior.offsetPrecise,
          current: prior.current,
          teeth: mergedTeeth,
        }
      : { ...gear, teeth: mergedTeeth };
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

function updatePreciseGearsFromOffsets(macKey: string, offsets: number[]) {
  if (!macKey || !offsets.length) return;
  const normalized = macKey.toUpperCase();
  const existing = gears.get()[normalized];
  if (!existing?.length) return;
  const updated = existing.map((gear) => {
    const nextPrecise = offsets[gear.gearNumber - 1];
    if (!Number.isFinite(nextPrecise)) return gear;
    return {
      ...gear,
      offsetPrecise: nextPrecise,
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
        response.absolutePosition ?? null,
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

export async function absoluteMove(targetPosition: number) {
  const deviceCommands = commands.get();
  if (!deviceCommands) return;
  const clampedTarget = clampOffsetToBounds(targetPosition);
  appendLog("Absolute move...", {
    targetPosition,
    clampedTarget,
  });
  try {
    const response = await deviceCommands.absoluteMove(clampedTarget);
    appendLog("Absolute move result", response ?? {});
    if (response.status === "success") {
      await getPosition();
    }
    return response;
  } catch (err) {
    appendLog("Absolute move error", err instanceof Error ? err.message : err);
    return null;
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
      updateApproximateGears(
        getActiveMacKey(),
        response.values,
        response.teeth,
      );
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

export async function refreshCogsData() {
  await getRearCogInfo();
  await getPosition();
}

export async function ensureGearsForMac(macKey: string) {
  if (!macKey) return;
  const normalized = macKey.toUpperCase();
  const existing = gears.get()[normalized];
  if (existing?.length) return;
  await refreshCogsData();
}

export async function refreshCurrentGear() {
  const activeMac = getActiveMacKey();
  if (!activeMac) return;
  await getPosition();
}

export function reloadCogProfiles() {
  cogProfiles.set(readStoredCogProfiles());
}

function validateNewProfileName(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return { ok: false as const, message: "Profile name is required." };
  }

  const existingProfiles = cogProfiles.get();
  if (
    existingProfiles.some(
      (profile) =>
        profile.name.localeCompare(normalizedName, undefined, {
          sensitivity: "accent",
        }) === 0,
    )
  ) {
    return { ok: false as const, message: "Profile name must be unique." };
  }

  return { ok: true as const, normalizedName, existingProfiles };
}

export function saveCogProfileFromEntries(
  name: string,
  cogs: CogProfileEntry[],
) {
  const nameResult = validateNewProfileName(name);
  if (!nameResult.ok) return nameResult;

  if (!cogs.length) {
    return { ok: false as const, message: "No cog data to save." };
  }

  const profile: CogProfile = {
    name: nameResult.normalizedName,
    cogs,
  };
  setCogProfiles([...nameResult.existingProfiles, profile]);
  return { ok: true as const };
}

export function saveCurrentCogProfile(name: string) {
  const activeMac = getActiveMacKey();
  const currentGears = activeMac ? gears.get()[activeMac] : undefined;
  if (!currentGears?.length) {
    return {
      ok: false as const,
      message: "No cog data yet. Fetch rear cog info first.",
    };
  }

  const sorted = [...currentGears].sort((a, b) => a.gearNumber - b.gearNumber);
  if (sorted.some((gear) => gear.offsetPrecise === null)) {
    return {
      ok: false as const,
      message: "Shift through all gears to collect precise offsets first.",
    };
  }
  if (sorted.some((gear) => gear.teeth === null)) {
    return {
      ok: false as const,
      message: "Cog sizes are missing. Read rear cog info first.",
    };
  }

  return saveCogProfileFromEntries(
    name,
    sorted.map((gear) => ({
      offset: gear.offsetPrecise ?? 0,
      toothCount: gear.teeth ?? 0,
    })),
  );
}

export function removeCogProfile(name: string) {
  const existingProfiles = cogProfiles.get();
  const next = existingProfiles.filter((profile) => profile.name !== name);
  setCogProfiles(next);
}

export function renameCogProfile(currentName: string, nextName: string) {
  const normalizedCurrentName = currentName.trim();
  if (!normalizedCurrentName) {
    return { ok: false as const, message: "Profile not found." };
  }

  const normalizedNextName = nextName.trim();
  if (!normalizedNextName) {
    return { ok: false as const, message: "Profile name is required." };
  }

  const existingProfiles = cogProfiles.get();
  const profileIndex = existingProfiles.findIndex(
    (profile) => profile.name === normalizedCurrentName,
  );
  if (profileIndex < 0) {
    return { ok: false as const, message: "Profile not found." };
  }

  const duplicateExists = existingProfiles.some((profile, index) => {
    if (index === profileIndex) return false;
    return (
      profile.name.localeCompare(normalizedNextName, undefined, {
        sensitivity: "accent",
      }) === 0
    );
  });
  if (duplicateExists) {
    return { ok: false as const, message: "Profile name must be unique." };
  }

  if (
    existingProfiles[profileIndex].name.localeCompare(
      normalizedNextName,
      undefined,
      {
        sensitivity: "accent",
      },
    ) === 0
  ) {
    return { ok: true as const };
  }

  const nextProfiles = [...existingProfiles];
  nextProfiles[profileIndex] = {
    ...nextProfiles[profileIndex],
    name: normalizedNextName,
  };
  setCogProfiles(nextProfiles);
  return { ok: true as const };
}

export async function applyCogProfile(name: string) {
  const deviceCommands = commands.get();
  if (!deviceCommands) {
    return { ok: false as const, message: "Connect to a hub first." };
  }
  const profile = cogProfiles.get().find((item) => item.name === name);
  if (!profile) {
    return { ok: false as const, message: "Profile not found." };
  }

  cogsProfileWriteInProgress.set(true);
  appendLog("Apply cog profile...", {
    name: profile.name,
    cogCount: profile.cogs.length,
  });
  try {
    const offsets = profile.cogs.map((cog) => cog.offset);
    const teeth = profile.cogs.map((cog) => cog.toothCount);
    const response = await deviceCommands.setRearCogInfo(offsets, teeth);
    appendLog("Apply cog profile write result", response ?? {});
    if (response.status !== "success") {
      return { ok: false as const, message: "Failed to write profile." };
    }
    await refreshCogsData();
    appendLog("Apply cog profile readback complete", {
      name: profile.name,
    });
    return { ok: true as const };
  } catch (err) {
    appendLog(
      "Apply cog profile error",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "Failed to apply profile.",
    };
  } finally {
    cogsProfileWriteInProgress.set(false);
  }
}

export async function writeSetupRearCogs(offsets: number[], teeth?: number[]) {
  const deviceCommands = commands.get();
  if (!deviceCommands) {
    return { ok: false as const, message: "Connect to a hub first." };
  }

  const sanitizedOffsets = offsets.filter((value): value is number =>
    Number.isFinite(value),
  );
  if (!sanitizedOffsets.length) {
    return { ok: false as const, message: "No cog offsets to write." };
  }

  const sanitizedTeeth =
    Array.isArray(teeth) && teeth.length === sanitizedOffsets.length
      ? teeth.map((value) => {
          const safe = Number.isFinite(value) ? Math.round(value) : 0;
          return Math.min(255, Math.max(0, safe));
        })
      : sanitizedOffsets.map(() => 0);

  cogsProfileWriteInProgress.set(true);
  appendLog("Write setup cogs...", {
    cogCount: sanitizedOffsets.length,
    teethCount: sanitizedTeeth.length,
  });
  try {
    const response = await deviceCommands.setRearCogInfo(
      sanitizedOffsets,
      sanitizedTeeth,
    );
    appendLog("Write setup cogs result", response ?? {});
    if (response.status !== "success") {
      return { ok: false as const, message: "Failed to write setup cogs." };
    }
    const activeMac = getActiveMacKey();
    if (activeMac) {
      updatePreciseGearsFromOffsets(activeMac, sanitizedOffsets);
    }
    await refreshCogsData();
    const refreshedMac = getActiveMacKey();
    if (refreshedMac) {
      updatePreciseGearsFromOffsets(refreshedMac, sanitizedOffsets);
    }
    appendLog("Write setup cogs readback complete", {
      cogCount: sanitizedOffsets.length,
    });
    return { ok: true as const };
  } catch (err) {
    appendLog(
      "Write setup cogs error",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false as const,
      message:
        err instanceof Error ? err.message : "Failed to write setup cogs.",
    };
  } finally {
    cogsProfileWriteInProgress.set(false);
  }
}
