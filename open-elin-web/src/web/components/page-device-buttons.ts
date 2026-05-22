import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";

import {
    ACTION_LABELS,
    BUTTON_LABELS,
    FUNCTION_LABELS
} from "open-elin-lib/commands";
import type { PodModel } from "open-elin-lib/pod-models";
import {
    getPodModel,
    isButtonWired,
} from "open-elin-lib/pod-models";
import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./pod-diagram.ts";
import "./refresh-button.ts";

interface ButtonGroup {
  buttonCode: string;
  buttonLabel: string;
  entries: any[];
}

function groupByButton(entries: any[]): ButtonGroup[] {
  const map = new Map<string, ButtonGroup>();
  for (const entry of entries) {
    const code = entry.button1?.code ?? "";
    if (!map.has(code)) {
      map.set(code, {
        buttonCode: code,
        buttonLabel: entry.button1?.label || code,
        entries: [],
      });
    }
    map.get(code)!.entries.push(entry);
  }
  return [...map.values()];
}

const ACTION_OPTIONS = [
  { code: "00", label: "Press" },
  { code: "01", label: "Release" },
  { code: "02", label: "Double press" },
];

const FUNCTION_OPTIONS = [
  { code: "0A", label: "Shift Up" },
  { code: "0B", label: "Shift Down" },
  { code: "0C", label: "Toggle" },
  { code: "0D", label: "Seatpost Lock" },
  { code: "0E", label: "Seatpost Unlock" },
  { code: "0F", label: "Auto Up" },
  { code: "10", label: "Auto Down" },
  { code: "11", label: "Tune Mode" },
];

export class PageDeviceButtons extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .card {
        background: var(--panel, #141c24);
        border-radius: 16px;
        padding: 18px 20px;
        border: 1px solid var(--panel-border, #223142);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }

      .card-head {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
      }

      .card-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .pod-group {
        margin-bottom: 16px;
      }

      .pod-group-header {
        font-size: 13px;
        color: var(--muted, #98a6b5);
        margin-bottom: 12px;
        border-bottom: 1px solid #233143;
        padding-bottom: 6px;
      }

      .button-groups {
        display: grid;
        gap: 10px;
      }

      .button-group {
        padding: 8px 14px;
        border-radius: 12px;
        background: #101822;
        border: 1px solid #233143;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: start;
        gap: 0 12px;
      }

      .button-group-label {
        font-size: 15px;
        font-weight: 600;
        grid-column: 1;
        grid-row: 1;
        align-self: center;
        white-space: nowrap;
        min-width: 2.5em;
      }

      .button-group-bindings {
        grid-column: 2;
        grid-row: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .button-group-add {
        grid-column: 3;
        grid-row: 1;
        align-self: center;
      }

      .binding-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 28px;
      }

      .binding-row .binding-placeholder {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        font-style: italic;
      }

      .binding-row select {
        background: #0c1018;
        color: #c0cad6;
        border: 1px solid #2a3a4e;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 13px;
        line-height: 1.2;
        box-sizing: border-box;
        height: 28px;
        min-width: 100px;
      }

      .binding-arrow {
        color: var(--muted, #98a6b5);
        font-size: 14px;
      }

      .icon-btn {
        background: none;
        border: 1px solid #2a3a4e;
        border-radius: 6px;
        color: #c0cad6;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 7px;
      }

      .icon-btn:hover {
        background: rgba(88, 110, 134, 0.25);
        border-color: #4a6a8e;
      }

      .pod-indicator {
        max-width: 280px;
        margin-bottom: 12px;
        overflow: hidden;
        border-radius: 18px;
      }

      .pod-indicator-label {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(140, 255, 200, 0.4);
        background: rgba(8, 14, 22, 0.9);
        color: rgba(170, 255, 220, 0.95);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
      }

      .orphan-section {
        margin-top: 16px;
      }

      .orphan-section-header {
        font-size: 13px;
        color: var(--muted, #98a6b5);
        margin-bottom: 8px;
      }

      .empty-state {
        margin-top: 16px;
        padding: 18px;
        border-radius: 12px;
        border: 1px dashed #3a4a5c;
        background: rgba(20, 30, 40, 0.6);
        min-height: 140px;
        display: flex;
        align-items: center;
        color: var(--muted, #98a6b5);
      }

      .mapping-list {
        display: grid;
        gap: 12px;
      }

      .mapping-card {
        padding: 14px 16px;
        border-radius: 14px;
        background: #101822;
        border: 1px solid #233143;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mapping-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .mapping-title {
        font-size: 16px;
        font-weight: 600;
      }

      .mapping-subtitle {
        font-size: 12px;
        color: var(--muted, #98a6b5);
      }

      .mapping-badge {
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        background: rgba(88, 110, 134, 0.2);
        color: #c0cad6;
      }

      .mapping-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin: 0;
      }

      .mapping-grid div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .mapping-grid dt {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted, #98a6b5);
      }

      .mapping-grid dd {
        margin: 0;
        font-size: 14px;
      }
    `,
  ];

  static properties = {
    loading: { type: Boolean, attribute: false },
  };

  declare loading: boolean;

  constructor() {
    super();
    this.loading = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (appState.connected.get() && appState.mac.get()) {
      void this.onReadButtonTable();
    }
  }

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const buttonTable = appState.buttonTable.get();
    const firstEntry = appState.listEntries.get()?.[0];
    const firstPodMac: string | undefined = firstEntry?.mac;

    // Group entries by pod MAC
    const podGroups = new Map<string, any[]>();
    for (const entry of buttonTable ?? []) {
      const mac = entry.podAddressHex ?? "";
      if (!podGroups.has(mac)) podGroups.set(mac, []);
      podGroups.get(mac)!.push(entry);
    }

    return html`
      <div class="card">
        <div class="card-head">
          <div class="card-head-row">
            <h2>Buttons</h2>
            <div style="display:flex;gap:8px;align-items:center;">
              ${firstPodMac
                ? html`<sl-button
                    size="small"
                    variant="default"
                    data-test-id="device-buttons-write-default"
                    ?disabled=${!canSend}
                    @click=${() => this.onWriteDefault(firstPodMac)}
                  >Write Default</sl-button>`
                : nothing}
              <refresh-button
                data-test-id="device-buttons-refresh"
                ?disabled=${!canSend}
                .loading=${this.loading}
                @refresh-requested=${this.onReadButtonTable}
              ></refresh-button>
            </div>
          </div>
          <p class="hint">Configure button-to-action mapping per pod.</p>
        </div>
        ${podGroups.size > 0
          ? html`<div data-test-id="device-buttons-list">
              ${[...podGroups.entries()].map(([mac, entries]) =>
                this.renderPodGroup(mac, entries),
              )}
            </div>`
          : html`
              <div
                class="empty-state"
                role="status"
                aria-live="polite"
                data-test-id="device-buttons-empty"
              >
                No button table loaded yet.
              </div>
            `}
      </div>
    `;
  }

  private renderPodGroup(podMacHex: string, entries: any[]) {
    const podName =
      appState.listEntries.get()?.find((e: any) => {
        const mac = e.mac
          ?.split(":")
          .reverse()
          .join("")
          .toUpperCase();
        return mac === podMacHex.toUpperCase();
      })?.name ?? "";
    const model = getPodModel(podName);
    const formattedMac = this.formatMac(podMacHex);

    const wiredEntries = entries.filter((e) =>
      isButtonWired(model, e.button1?.code ?? ""),
    );
    const orphanEntries = entries.filter(
      (e) => !isButtonWired(model, e.button1?.code ?? ""),
    );

    const wiredGroups = this.buildWiredGroups(model, wiredEntries);
    const orphanGroups = groupByButton(orphanEntries);

    return html`
      <div class="pod-group" data-test-id="pod-group">
        <div class="pod-group-header">
          Pod: ${formattedMac}${model ? ` (${model.displayName})` : ""}
        </div>
        <div class="pod-indicator" data-test-id="pod-indicator">
          <pod-diagram .positions=${this.getWiredPositions(model)}>
            ${this.renderDiagramLabels(model)}
          </pod-diagram>
        </div>
        ${wiredGroups.length > 0
          ? html`<div class="button-groups">
              ${wiredGroups.map((g) => this.renderButtonGroup(g, "wired", podMacHex))}
            </div>`
          : nothing}
        ${orphanGroups.length > 0
          ? html`<div class="orphan-section">
              <div class="orphan-section-header">Orphan Bindings</div>
              <div class="button-groups">
                ${orphanGroups.map((g) => this.renderButtonGroup(g, "orphan", podMacHex))}
              </div>
            </div>`
          : nothing}
      </div>
    `;
  }

  private renderButtonGroup(
    group: ButtonGroup,
    kind: "wired" | "orphan",
    podMacHex: string,
  ) {
    const testIdGroup =
      kind === "wired" ? "wired-button-group" : "orphan-button-group";
    const testIdBinding =
      kind === "wired" ? "wired-binding" : "orphan-binding";

    const usedTriggers = group.entries.map(
      (e: any) => e.action?.code ?? "",
    );
    const canAddTrigger = usedTriggers.length < 3;

    return html`
      <div class="button-group" data-test-id=${testIdGroup}>
        <span class="button-group-label">${group.buttonLabel}</span>
        <div class="button-group-bindings">
        ${group.entries.length > 0
          ? group.entries.map(
          (entry: any) => html`
            <div class="binding-row" data-test-id=${testIdBinding}>
              <select
                data-test-id="trigger-select"
                .value=${entry.action?.code ?? "00"}
                @change=${(e: Event) =>
                  this.onTriggerChange(e, entry, podMacHex)}
              >
                ${ACTION_OPTIONS.map(
                  (opt) => html`
                    <option
                      value=${opt.code}
                      ?selected=${opt.code === (entry.action?.code ?? "")}
                    >
                      ${opt.label}
                    </option>
                  `,
                )}
              </select>
              <span class="binding-arrow">→</span>
              <select
                data-test-id="function-select"
                .value=${entry.function?.code ?? "0A"}
                @change=${(e: Event) =>
                  this.onFunctionChange(e, entry, podMacHex)}
              >
                ${FUNCTION_OPTIONS.map(
                  (opt) => html`
                    <option
                      value=${opt.code}
                      ?selected=${opt.code ===
                      (entry.function?.code ?? "")}
                    >
                      ${opt.label}
                    </option>
                  `,
                )}
              </select>
              <button
                class="icon-btn"
                type="button"
                title="Remove binding"
                aria-label="Remove binding"
                data-test-id="remove-binding"
                @click=${() =>
                  this.onRemoveBinding(entry, podMacHex)}
              >×</button>
            </div>
          `,
        )
          : html`<div class="binding-row"><span class="binding-placeholder">No bindings</span></div>`}
        </div>
        ${canAddTrigger
          ? html`<button
              class="icon-btn button-group-add"
              type="button"
              title="Add trigger"
              aria-label="Add trigger"
              data-test-id="add-trigger"
              @click=${() =>
                this.onAddTrigger(group.buttonCode, podMacHex)}
            >+</button>`
          : nothing}
      </div>
    `;
  }

  private buildWiredGroups(model: PodModel | undefined, wiredEntries: any[]): ButtonGroup[] {
    if (!model) return groupByButton(wiredEntries);
    const entryGroups = groupByButton(wiredEntries);
    const seen = new Set(entryGroups.map((g) => g.buttonCode));
    for (const code of model.wiredButtons) {
      const upper = code.toUpperCase();
      if (!seen.has(upper)) {
        entryGroups.push({
          buttonCode: upper,
          buttonLabel: BUTTON_LABELS[upper] ?? upper,
          entries: [],
        });
      }
    }
    // Sort by model wired order
    const order = model.wiredButtons.map((c) => c.toUpperCase());
    entryGroups.sort((a, b) => {
      const ia = order.indexOf(a.buttonCode);
      const ib = order.indexOf(b.buttonCode);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return entryGroups;
  }

  // Wired buttons map 1:1 by index to physical positions (tune, up, down, …)
  private getWiredPositions(model: PodModel | undefined) {
    if (!model) return [];
    const count = model.wiredButtons.length;
    return (model.buttonPositions ?? []).slice(0, count);
  }

  private renderDiagramLabels(model: PodModel | undefined) {
    if (!model) return nothing;
    const positions = model.buttonPositions ?? [];
    return model.wiredButtons.map((code, i) => {
      if (i >= positions.length) return nothing;
      const label = BUTTON_LABELS[code.toUpperCase()] ?? code;
      return html`<span slot=${positions[i].name} class="pod-indicator-label">${label}</span>`;
    });
  }

  private async onFunctionChange(event: Event, entry: any, podMacHex: string) {
    const select = event.target as HTMLSelectElement;
    await this.rebuildAndWrite(podMacHex, (entries) =>
      entries.map((e) =>
        e === entry
          ? {
              ...e,
              function: {
                code: select.value,
                label: FUNCTION_LABELS[select.value] ?? select.value,
              },
            }
          : e,
      ),
    );
  }

  private async onTriggerChange(event: Event, entry: any, podMacHex: string) {
    const select = event.target as HTMLSelectElement;
    await this.rebuildAndWrite(podMacHex, (entries) =>
      entries.map((e) =>
        e === entry
          ? {
              ...e,
              action: {
                code: select.value,
                label: ACTION_LABELS[select.value] ?? select.value,
              },
            }
          : e,
      ),
    );
  }

  private async onAddTrigger(buttonCode: string, podMacHex: string) {
    await this.rebuildAndWrite(podMacHex, (entries) => {
      const usedTriggers = entries
        .filter((e: any) => e.button1?.code === buttonCode)
        .map((e: any) => e.action?.code);
      const nextTrigger = ["00", "01", "02"].find(
        (t) => !usedTriggers.includes(t),
      );
      if (!nextTrigger) return entries;
      const newEntry = {
        podAddressHex: podMacHex,
        elinkAddressHex: entries[0]?.elinkAddressHex ?? "",
        button1: {
          code: buttonCode,
          label: BUTTON_LABELS[buttonCode] ?? buttonCode,
        },
        button2: { code: "00", label: "-" },
        action: {
          code: nextTrigger,
          label: ACTION_LABELS[nextTrigger] ?? nextTrigger,
        },
        function: { code: "0A", label: "Shift Up" },
      };
      return [...entries, newEntry];
    });
  }

  private async onRemoveBinding(entry: any, podMacHex: string) {
    await this.rebuildAndWrite(podMacHex, (entries) =>
      entries.filter((e) => e !== entry),
    );
  }

  private async rebuildAndWrite(
    podMacHex: string,
    transform: (entries: any[]) => any[],
  ) {
    if (this.loading) return;
    this.loading = true;
    try {
      const currentTable = appState.buttonTable.get() ?? [];
      const podEntries = currentTable.filter(
        (e: any) => (e.podAddressHex ?? "") === podMacHex,
      );
      const otherEntries = currentTable.filter(
        (e: any) => (e.podAddressHex ?? "") !== podMacHex,
      );
      const updated = transform(podEntries);
      const merged = [...otherEntries, ...updated].map((e: any, i: number) => ({
        ...e,
        index: i,
      }));
      await appActions.writeButtonMap(merged);
    } finally {
      this.loading = false;
    }
  }

  private async onReadButtonTable() {
    if (this.loading) return;
    this.loading = true;
    try {
      const needsList = !(appState.listEntries.get()?.length > 0);
      await Promise.all([
        appActions.readButtonTable(),
        ...(needsList ? [appActions.getList()] : []),
      ]);
    } finally {
      this.loading = false;
    }
  }

  private async onWriteDefault(podMac: string) {
    await appActions.writeDefaultButtonMap(podMac);
  }

  private formatMac(hex?: string) {
    if (!hex || hex.length < 12) return "";
    const pairs: string[] = [];
    for (let i = 0; i < 12; i += 2) {
      pairs.push(hex.substring(i, i + 2));
    }
    return pairs.reverse().join(":").toUpperCase();
  }
}

if (!customElements.get("page-device-buttons")) {
  customElements.define("page-device-buttons", PageDeviceButtons);
}

export { };
