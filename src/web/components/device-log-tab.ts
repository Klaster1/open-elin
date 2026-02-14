import { LitElement, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceLogTab extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  render() {
    const logLines = appState.logLines.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Log</h2>
          <p class="hint">Notifications and command results appear here.</p>
        </div>
        <pre class="log">${logLines.join("\n")}</pre>
      </div>
    `;
  }
}

customElements.define("device-log-tab", DeviceLogTab);

export {};
