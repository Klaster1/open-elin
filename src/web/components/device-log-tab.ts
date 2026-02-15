import { LitElement, css, html } from "lit";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { SignalWatcher } from "@lit-labs/signals";

import { appState } from "../store.ts";
import { sharedStyles } from "../styles.ts";

class DeviceLogTab extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .card {
        background: var(--panel, #141c24);
        border-radius: 16px;
        padding: 18px 20px;
        border: 1px solid var(--panel-border, #223142);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        max-height: calc(100vh - 220px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
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
        overflow: auto;
        flex: 1;
        min-height: 0;
      }
    `,
  ];

  private logRef: Ref<HTMLPreElement> = createRef();
  private wasAtBottom = true;

  render() {
    const logLines = appState.logLines.get();
    return html`
      <div class="card">
        <div class="card-head">
          <h2>Log</h2>
          <p class="hint">Notifications and command results appear here.</p>
        </div>
        <pre
          class="log"
          ${ref(this.logRef)}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
${logLines.join("\n")}</pre
        >
      </div>
    `;
  }

  protected willUpdate() {
    const log = this.logRef.value;
    if (!log) return;
    this.wasAtBottom = this.isAtBottom(log);
  }

  protected updated() {
    if (!this.wasAtBottom) return;
    const log = this.logRef.value;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }

  private isAtBottom(element: HTMLElement) {
    const threshold = 12;
    return (
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - threshold
    );
  }
}

customElements.define("device-log-tab", DeviceLogTab);

export {};
