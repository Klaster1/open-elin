import { signal } from "@lit-labs/signals";

import demoData from "./demo-data.json";

type DemoData = typeof demoData;

type DemoList = DemoData["list"];
type DemoShiftComplete = DemoData["shiftComplete"];
type DemoBatterySample = DemoData["batteryNotifications"][number];
type DemoBatterySamples = DemoData["batteryNotifications"];

type DemoTransportDelays = {
  commandExecutionMs: number;
  batteryIntervalMs: number;
};

type DemoStateShape = DemoData & {
  transportDelays: DemoTransportDelays;
};

const DEFAULT_TRANSPORT_DELAYS: DemoTransportDelays = {
  commandExecutionMs: 0,
  batteryIntervalMs: 5000,
};

class DemoStateModel {
  readonly state = signal<DemoStateShape>({
    ...structuredClone(demoData),
    transportDelays: { ...DEFAULT_TRANSPORT_DELAYS },
  });

  getPodMac() {
    const entries = this.state.get().list.entries;
    return entries.length ? entries[0].mac : "";
  }

  updatePodBatteryLevel(millivolts: number) {
    const podMac = this.getPodMac();
    if (!podMac) return;
    const current = this.state.get();
    const nextList = structuredClone(current.list);
    nextList.entries = nextList.entries.map((entry) =>
      entry.mac === podMac ? { ...entry, batteryVoltage: millivolts } : entry,
    );

    const nextSamples: DemoBatterySample[] = structuredClone(
      current.batteryNotifications,
    );
    const rawHex = millivoltsToHex(millivolts);
    for (const sample of nextSamples) {
      if (sample.targetMac === podMac) {
        sample.rawHex = rawHex;
      }
    }
    this.state.set({
      ...current,
      list: nextList,
      batteryNotifications: nextSamples,
    });
  }
}

export const demoState = new DemoStateModel();

export type DemoState = ReturnType<DemoStateModel["state"]["get"]>;
export type { DemoBatterySample, DemoStateModel };

function millivoltsToHex(millivolts: number) {
  const clamped = Math.max(0, Math.min(0xffff, Math.round(millivolts)));
  const low = clamped & 0xff;
  const high = (clamped >> 8) & 0xff;
  return `${toHexByte(low)}${toHexByte(high)}`;
}

function toHexByte(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}
