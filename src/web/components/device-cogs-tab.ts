import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

export class DeviceCogsTab extends SignalWatcher(LitElement) {
  private readonly absoluteSteps = [10, 5, 1, 0.1] as const;

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

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .cog-controls {
        margin-top: 16px;
        display: grid;
        grid-template-columns: minmax(84px, 96px) minmax(0, 1fr) minmax(
            84px,
            96px
          );
        gap: 10px;
        align-items: stretch;
      }

      .shift-side {
        display: flex;
        justify-content: center;
        height: 100%;
      }

      .shift-side-button {
        width: 100%;
        height: 100%;
        min-height: 0;
      }

      .shift-side-button::part(base) {
        height: 100%;
      }

      .shift-side-button::part(label) {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .shift-side-content {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        line-height: 1;
      }

      .shift-side-content sl-icon {
        display: block;
        width: 1em;
        height: 1em;
        font-size: 26px;
      }

      .shift-side-label {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      @media (max-width: 860px) {
        .cog-controls {
          grid-template-columns: 1fr;
        }

        .shift-side-button {
          height: auto;
          min-height: 76px;
        }

        .shift-side-content {
          flex-direction: row;
          gap: 10px;
        }

        .shift-side-content sl-icon {
          font-size: 22px;
        }
      }

      .absolute-controls {
        margin-top: 12px;
        display: flex;
        flex-wrap: nowrap;
        gap: 10px;
        align-items: center;
        justify-content: center;
      }

      .absolute-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .absolute-center {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted, #98a6b5);
        padding: 0 4px;
      }

      .absolute-step {
        min-width: 64px;
      }

      .absolute-step::part(label) {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .absolute-step-content {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        line-height: 1;
      }

      .absolute-step-content sl-icon {
        display: block;
        width: 1em;
        height: 1em;
        font-size: 14px;
      }

      .gear-strip {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 6px;
        align-items: flex-end;
        justify-content: stretch;
        width: 100%;
        overflow: hidden;
        padding: 8px 2px 4px;
      }

      .gear-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .gear-number {
        font-size: 11px;
        font-weight: 600;
        color: var(--muted, #98a6b5);
        min-height: 16px;
        display: flex;
        align-items: flex-end;
      }

      .gear-teeth {
        font-size: 10px;
        font-weight: 600;
        color: #7ef0c3;
        min-height: 14px;
        display: flex;
        align-items: flex-end;
      }

      .gear-teeth.missing {
        color: var(--muted, #98a6b5);
      }

      .gear-line {
        width: 6px;
        height: var(--gear-height, 18px);
        border-radius: 999px;
        background: #3a4a5c;
      }

      .gear-offset {
        font-size: 11px;
        font-weight: 600;
        min-height: 16px;
        display: flex;
        align-items: flex-end;
      }

      .gear-offset.precise {
        color: #7ef0c3;
      }

      .gear-offset.approx {
        color: var(--warn, #ffb454);
      }

      .gear-offset.missing {
        color: var(--muted, #98a6b5);
      }

      .gear-current {
        height: 18px;
        color: #7ef0c3;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }

      .gear-current svg {
        width: 10px;
        height: 18px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
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

      .log {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid #233143;
        background: #0f1620;
        font-family: Consolas, monospace;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    const mac = appState.mac.get();
    if (appState.connected.get() && mac) {
      void appActions.ensureGearsForMac(mac);
    }
  }

  render() {
    const canSend = appState.connected.get() && Boolean(appState.mac.get());
    const mac = appState.mac.get();
    const gearMap = appState.gears.get();
    const gearList = mac ? gearMap[mac] : undefined;
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Cogs</h2>
          <p class="hint">Rear cog diagnostics and live position snapshots.</p>
        </div>
        <div class="actions">
          <sl-button ?disabled=${!canSend} @click=${this.onGetRearCogInfo}
            >Get rear cog info</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.onGetPosition}
            >Get position</sl-button
          >
        </div>
        <div class="absolute-controls">
          ${this.renderAbsoluteControls(canSend, gearList)}
        </div>
        ${this.renderCogControls(canSend, gearList)}
      </div>
    `;
  }

  private renderCogControls(
    canSend: boolean,
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    return html`
      <div class="cog-controls">
        <div class="shift-side shift-side-left">
          <sl-button
            class="shift-side-button"
            size="large"
            ?disabled=${!canSend}
            @click=${this.onShiftDown}
          >
            <span class="shift-side-content"
              ><sl-icon
                library="system"
                name="chevron-left"
                aria-hidden="true"
              ></sl-icon
              ><span class="shift-side-label">Shift down</span></span
            >
          </sl-button>
        </div>

        ${gearList?.length
          ? this.renderGearStrip(gearList)
          : html`
              <div class="empty-state" role="status" aria-live="polite">
                No gear data yet. Fetch rear cog info to get started.
              </div>
            `}

        <div class="shift-side shift-side-right">
          <sl-button
            class="shift-side-button"
            size="large"
            ?disabled=${!canSend}
            @click=${this.onShiftUp}
          >
            <span class="shift-side-content"
              ><sl-icon
                library="system"
                name="chevron-right"
                aria-hidden="true"
              ></sl-icon
              ><span class="shift-side-label">Shift up</span></span
            >
          </sl-button>
        </div>
      </div>
    `;
  }

  private renderAbsoluteControls(
    canSend: boolean,
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    const currentOffset = this.getCurrentAbsoluteOffset(gearList);
    const disabled = !canSend || currentOffset === null;
    return html`
      <div class="absolute-group" role="group" aria-label="Decrease absolute">
        ${this.absoluteSteps.map(
          (step) => html`
            <sl-button
              class="absolute-step"
              size="small"
              ?disabled=${disabled}
              @click=${() => this.onAbsoluteNudge(-step, currentOffset)}
            >
              <span class="absolute-step-content"
                ><sl-icon
                  library="system"
                  name="chevron-left"
                  aria-hidden="true"
                ></sl-icon
                >${step}</span
              ></sl-button
            >
          `,
        )}
      </div>
      <div class="absolute-center">tune</div>
      <div class="absolute-group" role="group" aria-label="Increase absolute">
        ${[...this.absoluteSteps].reverse().map(
          (step) => html`
            <sl-button
              class="absolute-step"
              size="small"
              ?disabled=${disabled}
              @click=${() => this.onAbsoluteNudge(step, currentOffset)}
            >
              <span class="absolute-step-content"
                >${step}<sl-icon
                  library="system"
                  name="chevron-right"
                  aria-hidden="true"
                ></sl-icon></span
            ></sl-button>
          `,
        )}
      </div>
    `;
  }

  private renderGearStrip(
    gears: Array<{
      gearNumber: number;
      offsetApproximate: number;
      offsetPrecise: number | null;
      current: boolean;
      teeth: number | null;
    }>,
  ) {
    const sorted = [...gears].sort((a, b) => a.gearNumber - b.gearNumber);
    const minGear = sorted[0]?.gearNumber ?? 1;
    const maxGear = sorted[sorted.length - 1]?.gearNumber ?? minGear;
    return html`
      <div class="gear-strip" role="list" aria-label="Rear cassette gears">
        ${sorted.map((gear) => this.renderGear(gear, minGear, maxGear))}
      </div>
    `;
  }

  private renderGear(
    gear: {
      gearNumber: number;
      offsetApproximate: number;
      offsetPrecise: number | null;
      current: boolean;
      teeth: number | null;
    },
    minGear: number,
    maxGear: number,
  ) {
    const range = Math.max(1, maxGear - minGear);
    const ratio = (gear.gearNumber - minGear) / range;
    const minHeight = 18;
    const maxHeight = 88;
    const height = Math.round(minHeight + ratio * (maxHeight - minHeight));
    const precise = gear.offsetPrecise;
    const offsetValue = precise ?? gear.offsetApproximate;
    const offsetLabel = Number.isFinite(offsetValue)
      ? offsetValue.toFixed(2)
      : "--";
    const offsetClass = precise !== null ? "precise" : "approx";
    const hasTeeth = Number.isFinite(gear.teeth);
    const teethLabel = hasTeeth ? `${gear.teeth}T` : "--";
    return html`
      <div class="gear-card" role="listitem">
        <div class="gear-number">${gear.gearNumber}</div>
        <div class="gear-teeth ${hasTeeth ? "" : "missing"}">${teethLabel}</div>
        <div class="gear-line" style="--gear-height: ${height}px"></div>
        <div class="gear-offset ${offsetClass}">${offsetLabel}</div>
        <div class="gear-current" aria-hidden=${!gear.current}>
          ${gear.current
            ? html`
                <svg viewBox="0 0 10 18" aria-hidden="true">
                  <path d="M5 17V3"></path>
                  <path d="M2 6L5 3L8 6"></path>
                </svg>
              `
            : ""}
        </div>
      </div>
    `;
  }

  private async onGetRearCogInfo() {
    await appActions.getRearCogInfo();
  }

  private async onGetPosition() {
    await appActions.getPosition();
  }

  private async onShiftUp() {
    await appActions.shiftUp();
  }

  private async onShiftDown() {
    await appActions.shiftDown();
  }

  private getCurrentAbsoluteOffset(
    gearList:
      | Array<{
          gearNumber: number;
          offsetApproximate: number;
          offsetPrecise: number | null;
          current: boolean;
          teeth: number | null;
        }>
      | undefined,
  ) {
    const currentGear = gearList?.find((gear) => gear.current);
    if (currentGear) {
      const gearOffset =
        currentGear.offsetPrecise ?? currentGear.offsetApproximate;
      if (Number.isFinite(gearOffset)) return gearOffset;
    }

    const absolutePosition = appState.position.get()?.absolutePosition;
    if (
      typeof absolutePosition === "number" &&
      Number.isFinite(absolutePosition)
    ) {
      return absolutePosition;
    }

    return null;
  }

  private async onAbsoluteNudge(delta: number, baseOffset: number | null) {
    if (baseOffset === null) return;
    const target = Math.round((baseOffset + delta) * 10) / 10;
    await appActions.absoluteMove(target);
  }
}

if (!customElements.get("device-cogs-tab")) {
  customElements.define("device-cogs-tab", DeviceCogsTab);
}

export {};
