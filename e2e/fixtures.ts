import { expect, test as base } from "@playwright/test";
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

type DemoScope = typeof globalThis & {
  __demo?: {
    hub?: DemoHubSignal;
    pod?: DemoPodSignal;
  };
};

type DemoFixtures = {
  updateDemoHubState: (
    mutator: DemoStateMutator<HubState>,
  ) => Promise<HubState>;
  updateDemoPodState: (
    mutator: DemoStateMutator<PodState>,
  ) => Promise<PodState>;
};

const test = base.extend<DemoFixtures>({
  updateDemoHubState: async ({ page }, use) => {
    await use(async (mutator) => {
      const current = await page.evaluate(() => {
        const scope = globalThis as DemoScope;
        const hub = scope.__demo?.hub;
        if (!hub) {
          throw new Error(
            "Demo hub is not available on globalThis.__demo before demo start.",
          );
        }

        return hub.state.get();
      });

      const draft = structuredClone(current);
      mutator(draft);

      return page.evaluate((next) => {
        const scope = globalThis as DemoScope;
        const hub = scope.__demo?.hub;
        if (!hub) {
          throw new Error(
            "Demo hub is not available on globalThis.__demo before demo start.",
          );
        }

        hub.state.set(next);
        return hub.state.get();
      }, draft);
    });
  },
  updateDemoPodState: async ({ page }, use) => {
    await use(async (mutator) => {
      const current = await page.evaluate(() => {
        const scope = globalThis as DemoScope;
        const pod = scope.__demo?.pod;
        if (!pod) {
          throw new Error(
            "Demo pod is not available on globalThis.__demo before demo start.",
          );
        }

        return pod.state.get();
      });

      const draft = structuredClone(current);
      mutator(draft);

      return page.evaluate((next) => {
        const scope = globalThis as DemoScope;
        const pod = scope.__demo?.pod;
        if (!pod) {
          throw new Error(
            "Demo pod is not available on globalThis.__demo before demo start.",
          );
        }

        pod.state.set(next);
        return pod.state.get();
      }, draft);
    });
  },
});

export { expect, test };
