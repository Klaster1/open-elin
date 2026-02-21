import { signal } from "@lit-labs/signals";

import hubData from "./hub-mock-data.json";

type HubData = typeof hubData;

type HubStateShape = HubData;

type ShiftDirection = "up" | "down";

type RearCogs = HubStateShape["rearCogs"];

type CurrentPosition = HubStateShape["current"];

export class HubMock {
  readonly state = signal<HubStateShape>(structuredClone(hubData));
  private readonly minOffset = 0;
  private readonly maxOffset = 250;
  private readonly maxNameLength = 16;

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
