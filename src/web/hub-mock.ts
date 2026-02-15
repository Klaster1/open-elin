import { signal } from "@lit-labs/signals";

import hubData from "./hub-mock-data.json";

type HubData = typeof hubData;

type HubState = HubData;

type ShiftDirection = "up" | "down";

type RearCogs = HubState["rearCogs"];

type CurrentPosition = HubState["current"];

export class HubMock {
  readonly state = signal<HubState>(structuredClone(hubData));

  getDevice() {
    return this.state.get().device;
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
    return buildRearCogBytes(rearCogs.approximate);
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
    this.updateCurrent({ gear: nextGear, offset: nextOffset });
  }

  applyTuneShift(direction: ShiftDirection, step: number) {
    const current = this.state.get().current;
    const rearCogs = this.state.get().rearCogs;
    const index = clampGear(current.gear, rearCogs.approximate.length) - 1;
    const delta = direction === "up" ? step : -step;
    const nextOffset = Math.max(0, current.offset + delta);
    const nextApprox = [...rearCogs.approximate];
    const nextPrecise = [...rearCogs.precise];
    nextApprox[index] = Math.max(0, nextApprox[index] + delta);
    nextPrecise[index] = nextOffset;
    this.updateState({
      rearCogs: {
        approximate: nextApprox,
        precise: nextPrecise,
      },
      current: { gear: current.gear, offset: nextOffset },
    });
  }

  private updateCurrent(next: CurrentPosition) {
    const current = this.state.get();
    this.state.set({ ...current, current: next });
  }

  private updateState(next: Partial<HubState>) {
    const current = this.state.get();
    this.state.set({ ...current, ...next });
  }
}

function buildRearCogBytes(values: number[]) {
  const chunks = values.map((value) => {
    const scaled = Math.max(0, Math.round(value * 10));
    return [0x00, (scaled >> 8) & 0xff, scaled & 0xff];
  });
  const reversed = chunks.reverse().flat();
  return new Uint8Array(reversed);
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

export type { RearCogs, CurrentPosition };
