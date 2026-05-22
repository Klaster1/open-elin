import { signal } from "@lit-labs/signals";

import { buildDefaultButtonMap } from "open-elin-lib/default-button-map";
import { demoState } from "./demo-state.ts";
import hubData from "./hub-mock-data.json";

type HubData = typeof hubData;

type HubStateShape = HubData;

type ShiftDirection = "up" | "down";

type RearCogs = HubStateShape["rearCogs"];

type CurrentPosition = HubStateShape["current"];

export const HUB_MOCK_MIN_OFFSET = 0;
export const HUB_MOCK_MAX_OFFSET = 250;

export class HubMock {
  readonly state = signal<HubStateShape>(structuredClone(hubData));
  readonly pairingWindow = signal(false);
  private pairingWindowTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minOffset = HUB_MOCK_MIN_OFFSET;
  private readonly maxOffset = HUB_MOCK_MAX_OFFSET;
  private readonly maxNameLength = 16;

  reset() {
    if (this.pairingWindowTimer !== null) {
      clearTimeout(this.pairingWindowTimer);
      this.pairingWindowTimer = null;
    }
    this.state.set(structuredClone(hubData));
    demoState.clearDeviceEntries();
    const gear1Offset = this.state.get().rearCogs.approximate[0] ?? 0;
    this.updateState({
      current: { gear: 1, offset: gear1Offset },
      buttonTable: [],
    });
    this.pairingWindow.set(true);
    this.pairingWindowTimer = setTimeout(() => {
      this.pairingWindow.set(false);
      this.pairingWindowTimer = null;
    }, 60_000);
  }

  pair(podMac: string) {
    if (!this.pairingWindow.get()) return;
    const hubMac = this.state.get().device.mac;
    demoState.addDeviceEntry({
      mac: podMac,
      name: "NXS MTB Pod",
      deviceId: 10,
      isConnected: true,
      batteryVoltage: 3000,
      rssi: 178,
    });
    const entries = buildDefaultButtonMap(podMac, hubMac).map(
      ({ index: _index, ...rest }) => ({
        podAddressHex: rest.podAddressHex,
        elinkAddressHex: rest.elinkAddressHex,
        button1: { code: rest.button1.code, label: rest.button1.label ?? "" },
        button2: { code: rest.button2.code, label: rest.button2.label ?? "" },
        action: { code: rest.action.code, label: rest.action.label ?? "" },
        function: { code: rest.function.code, label: rest.function.label ?? "" },
      }),
    );
    this.updateState({ buttonTable: entries });
    this.pairingWindow.set(false);
    if (this.pairingWindowTimer !== null) {
      clearTimeout(this.pairingWindowTimer);
      this.pairingWindowTimer = null;
    }
  }

  getDevice() {
    return this.state.get().device;
  }

  setDeviceName(name: string) {
    if (!name) return false;
    if (name.length > this.maxNameLength) return false;
    const current = this.state.get();
    this.state.set({
      ...current,
      device: {
        ...current.device,
        name,
      },
    });
    return true;
  }

  getButtonMapBytes() {
    return this.state.get().buttonMap.mapBytes;
  }

  getButtonTable() {
    return this.state.get().buttonTable;
  }

  getMotorParamsBytes() {
    return this.state.get().motorParams.rawBytes;
  }

  getRearCogApproximateBytes() {
    const rearCogs = this.state.get().rearCogs;
    return buildRearCogBytes(rearCogs.approximate, rearCogs.teeth);
  }

  setRearCogs(offsets: number[], teeth: number[]) {
    if (!offsets.length || offsets.length !== teeth.length) return false;
    const sanitizedOffsets = offsets.map((value) => this.boundOffset(value));
    const sanitizedTeeth = teeth.map((value) =>
      Math.max(0, Math.min(255, Math.round(value))),
    );
    const current = this.state.get().current;
    const maxGear = sanitizedOffsets.length;
    const nextGear = clampGear(current.gear, maxGear);
    const nextOffset =
      sanitizedOffsets[nextGear - 1] ?? sanitizedOffsets[0] ?? 0;
    this.updateState({
      rearCogs: {
        approximate: sanitizedOffsets,
        precise: [...sanitizedOffsets],
        teeth: sanitizedTeeth,
      },
      current: {
        gear: nextGear,
        offset: nextOffset,
      },
    });
    return true;
  }

  getPositionBytes() {
    const current = this.state.get().current;
    return buildPositionBytes(current.offset, current.gear);
  }

  applyGearShift(direction: ShiftDirection) {
    const current = this.state.get().current;
    const rearCogs = this.state.get().rearCogs;
    const nextGear = clampGear(
      current.gear + (direction === "up" ? 1 : -1),
      rearCogs.approximate.length,
    );
    const nextOffset =
      rearCogs.precise[nextGear - 1] ??
      rearCogs.approximate[nextGear - 1] ??
      current.offset;
    this.updateCurrent({
      gear: nextGear,
      offset: this.boundOffset(nextOffset),
    });
  }

  applyTuneShift(direction: ShiftDirection, step: number) {
    const current = this.state.get().current;
    const rearCogs = this.state.get().rearCogs;
    const index = clampGear(current.gear, rearCogs.approximate.length) - 1;
    const delta = direction === "up" ? step : -step;
    const nextOffset = this.boundOffset(current.offset + delta);
    const nextApprox = [...rearCogs.approximate];
    const nextPrecise = [...rearCogs.precise];
    nextApprox[index] = Math.max(0, nextApprox[index] + delta);
    nextPrecise[index] = nextOffset;
    this.updateState({
      rearCogs: {
        ...rearCogs,
        approximate: nextApprox,
        precise: nextPrecise,
      },
      current: { gear: current.gear, offset: nextOffset },
    });
  }

  applyAbsoluteMove(targetOffset: number) {
    const current = this.state.get().current;
    const rearCogs = this.state.get().rearCogs;
    const boundedOffset = this.boundOffset(targetOffset);
    const clampedGear = clampGear(current.gear, rearCogs.approximate.length);
    const index = clampedGear - 1;
    const nextApprox = [...rearCogs.approximate];
    const nextPrecise = [...rearCogs.precise];
    nextApprox[index] = boundedOffset;
    nextPrecise[index] = boundedOffset;
    this.updateState({
      rearCogs: {
        ...rearCogs,
        approximate: nextApprox,
        precise: nextPrecise,
      },
      current: { gear: clampedGear, offset: boundedOffset },
    });
  }

  private boundOffset(value: number) {
    const safeValue = Number.isFinite(value) ? value : this.minOffset;
    return Math.min(this.maxOffset, Math.max(this.minOffset, safeValue));
  }

  private updateCurrent(next: CurrentPosition) {
    const current = this.state.get();
    this.state.set({ ...current, current: next });
  }

  private updateState(next: Partial<HubStateShape>) {
    const current = this.state.get();
    this.state.set({ ...current, ...next });
  }

  clearButtonTable() {
    this.updateState({ buttonTable: [] });
  }

  appendButtonTableEntry(entry: HubStateShape["buttonTable"][number]) {
    const current = this.state.get();
    this.updateState({ buttonTable: [...current.buttonTable, entry] });
  }
}

function buildRearCogBytes(values: number[], teeth?: number[]) {
  const chunks = values.map((value, index) => {
    const scaled = Math.max(0, Math.round(value * 10));
    const toothCount =
      typeof teeth?.[index] === "number" && Number.isFinite(teeth[index])
        ? Math.max(0, Math.min(255, Math.round(teeth[index])))
        : 0;
    return [scaled & 0xff, (scaled >> 8) & 0xff, toothCount];
  });
  return new Uint8Array(chunks.flat());
}

function buildPositionBytes(offset: number, gear: number) {
  const scaled = Math.max(0, Math.round(offset * 10));
  const clampedGear = Math.max(1, Math.round(gear));
  return new Uint8Array([
    scaled & 0xff,
    (scaled >> 8) & 0xff,
    (clampedGear - 1) & 0xff,
  ]);
}

function clampGear(value: number, max: number) {
  if (Number.isNaN(value)) return 1;
  return Math.min(Math.max(value, 1), Math.max(1, max));
}

export type HubState = ReturnType<HubMock["state"]["get"]>;
export type { RearCogs, CurrentPosition };
