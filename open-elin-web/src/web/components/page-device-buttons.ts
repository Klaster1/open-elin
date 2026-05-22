import { LitElement, css, html, nothing } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";
import "./refresh-button.ts";

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
          <p class="hint">Current button-to-action mapping per pod.</p>
        </div>
        ${buttonTable?.length
          ? html`<div
              class="mapping-list"
              role="list"
              data-test-id="device-buttons-list"
            >
              ${buttonTable.map((entry: any, index: number) =>
                this.renderMapping(entry, index),
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

  private async onReadButtonTable() {
    if (this.loading) return;
    this.loading = true;
    try {
      await appActions.readButtonTable();
    } finally {
      this.loading = false;
    }
  }

  private async onWriteDefault(podMac: string) {
    await appActions.writeDefaultButtonMap(podMac);
  }

  private renderMapping(entry: any, index: number) {
    const pod = this.formatMac(entry?.podAddressHex);
    const button1 = entry?.button1?.label || "-";
    const button2 = entry?.button2?.label || "-";
    const action = entry?.action?.label || "-";
    const fnLabel = entry?.function?.label || "-";
    const buttons =
      button2 && button2 !== "-" ? `${button1} + ${button2}` : button1;

    return html`
      <div class="mapping-card" role="listitem" data-test-id="device-buttons-mapping">
        <div class="mapping-head">
          <div>
            <div class="mapping-title">${fnLabel}</div>
            <div class="mapping-subtitle">Pod ${pod || "--"}</div>
          </div>
          <div class="mapping-badge">#${index + 1}</div>
        </div>
        <dl class="mapping-grid">
          <div>
            <dt>Buttons</dt>
            <dd>${buttons}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>${action}</dd>
          </div>
        </dl>
      </div>
    `;
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

export {};
