import { LitElement, css, html } from "lit";
import { SignalWatcher, signal } from "@lit-labs/signals";

import { appActions, appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

export class PageDeviceSetup extends SignalWatcher(LitElement) {
  private setupMode = signal(false);

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

      .card-head h2 {
        margin: 0;
      }

      .hint {
        color: var(--muted, #98a6b5);
        font-size: 13px;
        margin: 0;
      }

      .summary {
        margin: 0 0 14px;
        color: var(--text, #e7edf5);
      }

      .summary strong {
        color: var(--text, #e7edf5);
      }

      .copy {
        margin: 0;
        color: var(--muted, #98a6b5);
        line-height: 1.5;
      }

      .copy + .copy {
        margin-top: 10px;
      }

      .actions {
        margin-top: 16px;
        display: flex;
        gap: 10px;
      }

      .pending {
        margin-top: 14px;
        padding: 12px;
        border-radius: 12px;
        border: 1px dashed #3a4a5c;
        color: var(--muted, #98a6b5);
        background: rgba(20, 30, 40, 0.6);
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    const activeMac = appState.mac.get();
    if (appState.connected.get() && activeMac) {
      void appActions.ensureGearsForMac(activeMac);
    }
  }

  render() {
    const activeMac = appState.mac.get().toUpperCase();
    const configuredCogs = activeMac
      ? appState.gears.get()[activeMac]?.length
      : undefined;

    return html`
      <div class="card" data-test-id="setup">
        <div class="card-head">
          <h2>Setup</h2>
          <p class="hint">Cassette reconfiguration flow.</p>
        </div>

        <p class="summary" data-test-id="setup-current-cog-count">
          Current configured cogs:
          <strong>${configuredCogs ?? "Unknown"}</strong>
        </p>

        <p class="copy">
          If the cog amount already matches your cassette, it is recommended to
          use Pod fine tuning for each position or the Cogs screen.
        </p>
        <p class="copy">
          If you want to reconfigure for another cassette with a different
          amount of cogs, press Start setup.
        </p>

        <div class="actions">
          <sl-button
            variant="primary"
            data-test-id="setup-start"
            @click=${this.startSetup}
          >
            Start setup
          </sl-button>
        </div>

        ${this.setupMode.get()
          ? html`
              <div class="pending" data-test-id="setup-mode-pending">
                Setup mode is enabled. Step controls will be added next.
              </div>
            `
          : html``}
      </div>
    `;
  }

  private startSetup() {
    this.setupMode.set(true);
  }
}

if (!customElements.get("page-device-setup")) {
  customElements.define("page-device-setup", PageDeviceSetup);
}

export {};
