import { LitElement, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceCogsTab extends SignalWatcher(LitElement) {
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

      .gear-strip {
        margin-top: 16px;
        display: flex;
        gap: 8px;
        align-items: flex-end;
        overflow-x: auto;
        padding: 8px 2px 4px;
      }

      .gear-card {
        min-width: 42px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .gear-number {
        font-size: 12px;
        font-weight: 600;
        color: var(--muted, #98a6b5);
        min-height: 16px;
        display: flex;
        align-items: flex-end;
      }

      .gear-line {
        width: 6px;
        height: var(--gear-height, 18px);
        border-radius: 999px;
        background: #3a4a5c;
      }

      .gear-offset {
        font-size: 12px;
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
          <sl-button ?disabled=${!canSend} @click=${this.onShiftUp}
            >Shift up</sl-button
          >
          <sl-button ?disabled=${!canSend} @click=${this.onShiftDown}
            >Shift down</sl-button
          >
        </div>
        ${gearList?.length
          ? this.renderGearStrip(gearList)
          : html`
              <div class="empty-state" role="status" aria-live="polite">
                No gear data yet. Fetch rear cog info to get started.
              </div>
            `}
      </div>
    `;
  }

  private renderGearStrip(
    gears: Array<{
      gearNumber: number;
      offsetApproximate: number;
      offsetPrecise: number | null;
      current: boolean;
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
    return html`
      <div class="gear-card" role="listitem">
        <div class="gear-number">${gear.gearNumber}</div>
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
}

customElements.define("device-cogs-tab", DeviceCogsTab);

export {};
