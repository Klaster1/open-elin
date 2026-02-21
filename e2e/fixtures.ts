import { expect, test as base } from "@playwright/test";
import type { DemoState } from "../src/web/demo-state.ts";
import type { HubState } from "../src/web/hub-mock.ts";
import type { PodState } from "../src/web/pod-mock.ts";

type DemoStateMutator<TState> = (draft: TState) => void;

type DemoHubSignal = {
  state: {
    get: () => HubState;
    set: (next: HubState) => void;
  };
};

type DemoPodSignal = {
  state: {
    get: () => PodState;
    set: (next: PodState) => void;
  };
};

type DemoDataSignal = {
  state: {
    get: () => DemoState;
    set: (next: DemoState) => void;
  };
};

type DemoScope = typeof globalThis & {
  __demo?: {
    hub?: DemoHubSignal;
    pod?: DemoPodSignal;
    data?: DemoDataSignal;
  };
};

type DemoKey = "hub" | "pod" | "data";
type DemoStateByKey = {
  hub: HubState;
  pod: PodState;
  data: DemoState;
};

type DemoFixtures = {
  updateDemoHubState: (
    mutator: DemoStateMutator<HubState>,
  ) => Promise<HubState>;
  updateDemoPodState: (
    mutator: DemoStateMutator<PodState>,
  ) => Promise<PodState>;
  updateDemoDataState: (
    mutator: DemoStateMutator<DemoState>,
  ) => Promise<DemoState>;
};

function createDemoStateUpdater(page: { evaluate: Page["evaluate"] }) {
  return async function updateByKey<TKey extends DemoKey>(
    key: TKey,
    missingError: string,
    mutator: DemoStateMutator<DemoStateByKey[TKey]>,
  ): Promise<DemoStateByKey[TKey]> {
    const current = await page.evaluate(
      ({ signalKey, errorMessage }) => {
        const scope = globalThis as DemoScope;
        const source = scope.__demo?.[signalKey as DemoKey];
        if (!source) {
          throw new Error(errorMessage);
        }

        return source.state.get();
      },
      { signalKey: key, errorMessage: missingError },
    );

    const draft = structuredClone(current);
    mutator(draft);

    return page.evaluate(
      ({ signalKey, errorMessage, next }) => {
        const scope = globalThis as DemoScope;
        const source = scope.__demo?.[signalKey as DemoKey];
        if (!source) {
          throw new Error(errorMessage);
        }

        source.state.set(next);
        return source.state.get();
      },
      {
        signalKey: key,
        errorMessage: missingError,
        next: draft,
      },
    );
  };
}

const test = base.extend<DemoFixtures>({
  updateDemoHubState: async ({ page }, use) => {
    const updateByKey = createDemoStateUpdater(page);
    await use((mutator) =>
      updateByKey(
        "hub",
        "Demo hub is not available on globalThis.__demo before demo start.",
        mutator,
      ),
    );
  },
  updateDemoPodState: async ({ page }, use) => {
    const updateByKey = createDemoStateUpdater(page);
    await use((mutator) =>
      updateByKey(
        "pod",
        "Demo pod is not available on globalThis.__demo before demo start.",
        mutator,
      ),
    );
  },
  updateDemoDataState: async ({ page }, use) => {
    const updateByKey = createDemoStateUpdater(page);
    await use((mutator) =>
      updateByKey(
        "data",
        "Demo data is not available on globalThis.__demo before demo start.",
        mutator,
      ),
    );
  },
});

export { expect, test };
