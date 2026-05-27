import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, type TemplateResult } from "lit";
import { createRef, ref, type Ref } from "lit/directives/ref.js";

import { appState, type LogEntry } from "../store.ts";
import { sharedStyles } from "../styles.ts";

export class ConsolePanel extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .pane-head {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        flex-shrink: 0;
        border-bottom: 1px solid var(--panel-border, #223142);
      }

      .pane-head h2 {
        font-size: 14px;
        margin: 0;
      }

      .log {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        padding: 10px 16px;
        background: #0f1620;
        font-family: Consolas, monospace;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .log-timestamp {
        color: var(--muted, #98a6b5);
        opacity: 0.6;
      }

      .json-key {
        color: #82aaff;
      }
      .json-string {
        color: #c3e88d;
      }
      .json-number {
        color: #f78c6c;
      }
      .json-bool {
        color: #c792ea;
      }
      .json-null {
        color: #ff5370;
      }
    `,
  ];

  private logRef: Ref<HTMLPreElement> = createRef();
  private wasAtBottom = true;

  render() {
    const entries = appState.logEntries.get();
    return html`
      <div class="pane-head" data-test-id="console-panel">
        <h2>Console</h2>
        <sl-button size="small" @click=${this.clearLog}>Clear</sl-button>
      </div>
      <pre
        class="log"
        data-test-id="console-panel-output"
        ${ref(this.logRef)}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >${entries.map((entry, index) => renderEntry(entry, index === 0))}</pre>
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

  private clearLog() {
    appState.logEntries.set([]);
  }

  private isAtBottom(element: HTMLElement) {
    const threshold = 12;
    return (
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - threshold
    );
  }
}

if (!customElements.get("console-panel")) {
  customElements.define("console-panel", ConsolePanel);
}

function renderEntry(entry: LogEntry, isFirst: boolean): TemplateResult {
  const separator = isFirst ? "" : "\n";
  return html`${separator}<span class="log-timestamp">[${entry.timestamp}]</span>${entry.segments.map(
    (segment) => {
      if (segment.kind === "json") {
        return html` ${renderJsonValue(segment.value, 0)}`;
      }
      return html` ${segment.value}`;
    },
  )}`;
}

const INDENT = 2;

function renderJsonValue(value: unknown, depth: number): TemplateResult {
  if (value === null) {
    return html`<span class="json-null">null</span>`;
  }
  if (typeof value === "boolean") {
    return html`<span class="json-bool">${String(value)}</span>`;
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? html`<span class="json-number">${String(value)}</span>`
      : html`<span class="json-null">null</span>`;
  }
  if (typeof value === "string") {
    return html`<span class="json-string">${JSON.stringify(value)}</span>`;
  }
  if (Array.isArray(value)) {
    return renderJsonArray(value, depth);
  }
  if (typeof value === "object") {
    return renderJsonObject(value as Record<string, unknown>, depth);
  }
  return html`<span class="json-null">null</span>`;
}

function renderJsonArray(arr: unknown[], depth: number): TemplateResult {
  if (arr.length === 0) return html`[]`;
  const pad = " ".repeat(INDENT * (depth + 1));
  const closePad = " ".repeat(INDENT * depth);
  const items = arr.map(
    (item, i) =>
      html`\n${pad}${renderJsonValue(item, depth + 1)}${i < arr.length - 1 ? "," : ""}`,
  );
  return html`[${items}\n${closePad}]`;
}

function renderJsonObject(
  obj: Record<string, unknown>,
  depth: number,
): TemplateResult {
  const keys = Object.keys(obj).filter(
    (key) => obj[key] !== undefined && typeof obj[key] !== "function",
  );
  if (keys.length === 0) return html`{}`;
  const pad = " ".repeat(INDENT * (depth + 1));
  const closePad = " ".repeat(INDENT * depth);
  const entries = keys.map(
    (key, i) =>
      html`\n${pad}<span class="json-key">${JSON.stringify(key)}</span>: ${renderJsonValue(obj[key], depth + 1)}${i < keys.length - 1 ? "," : ""}`,
  );
  return html`{${entries}\n${closePad}}`;
}

export {};
