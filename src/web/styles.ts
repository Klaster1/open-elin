import { css } from "lit";

export const sharedStyles = css`
  :host {
    display: block;
    color: var(--text, #e7edf5);
    --sans: Roboto, sans-serif;
    font-family: Roboto, sans-serif;
  }

  .app {
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 28px 60px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }

  h1 {
    font-size: 32px;
    margin: 0;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 18px;
    margin: 0;
  }

  .subtitle {
    color: var(--muted, #98a6b5);
    margin: 8px 0 0;
    font-size: 14px;
  }

  .card {
    background: var(--panel, #141c24);
    border-radius: 16px;
    padding: 18px 20px;
    border: 1px solid var(--panel-border, #223142);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  }

  .shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: 20px;
  }

  .sidebar-head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sidebar-title {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted, #98a6b5);
  }

  .sidebar-name {
    font-size: 13px;
    color: var(--muted, #98a6b5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .sidebar-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid #233143;
    background: #0f1620;
    color: inherit;
    cursor: pointer;
  }

  .icon-button:hover {
    border-color: #2b3a4b;
    background: #18222f;
  }

  .icon-button svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sidebar-mac {
    font-size: 18px;
    font-weight: 600;
    color: var(--text, #e7edf5);
  }

  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 12px;
    background: #0f1620;
    border: 1px solid transparent;
    color: inherit;
    text-decoration: none;
    font-weight: 600;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
  }

  .nav-link:hover {
    border-color: #2b3a4b;
    background: #18222f;
  }

  .nav-link.active {
    border-color: #3a4a5c;
    background: #1c2836;
    color: #e7edf5;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .pod-mock {
    position: fixed;
    right: 32px;
    bottom: 32px;
    width: 360px;
    z-index: 30;
    display: grid;
    place-items: center;
    pointer-events: auto;
  }

  .pod-mock-frame {
    position: relative;
    width: 100%;
    padding: 12px;
    border-radius: 22px;
    background: #101922;
    border: 1px solid #253245;
    box-shadow: 0 22px 55px rgba(0, 0, 0, 0.55);
  }

  .pod-mock img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 18px;
  }

  .pod-button {
    position: absolute;
    border-radius: 999px;
    border: 2px solid rgba(76, 255, 196, 0.7);
    background: rgba(76, 255, 196, 0.18);
    box-shadow: 0 0 12px rgba(76, 255, 196, 0.25);
    cursor: pointer;
    transform: translate(-50%, -50%);
  }

  .pod-button:hover {
    background: rgba(76, 255, 196, 0.28);
  }

  .pod-button:active {
    transform: translate(-50%, -50%) scale(0.96);
  }

  .pod-button-tune {
    width: 60px;
    height: 60px;
    top: 37%;
    left: 52%;
  }

  .pod-button-up {
    width: 60px;
    height: 60px;
    top: 37%;
    left: 76%;
  }

  .pod-button-down {
    width: 60px;
    height: 60px;
    top: 75%;
    left: 81%;
  }

  .device-list {
    display: grid;
    gap: 14px;
  }

  .device-card {
    padding: 14px 16px;
    border-radius: 14px;
    background: #101822;
    border: 1px solid #233143;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .device-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .device-name {
    font-size: 16px;
    font-weight: 600;
  }

  .device-mac {
    font-size: 12px;
    color: var(--muted, #98a6b5);
  }

  .device-pill {
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12px;
    background: rgba(88, 110, 134, 0.2);
    color: #c0cad6;
  }

  .device-pill.ok {
    background: rgba(53, 194, 139, 0.18);
    color: #7ef0c3;
  }

  .device-pill.warn {
    background: rgba(255, 180, 84, 0.15);
    color: var(--warn, #ffb454);
  }

  .device-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
  }

  .device-meta div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .device-meta dt {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted, #98a6b5);
  }

  .device-meta dd {
    margin: 0;
    font-size: 14px;
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

  .param-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
  }

  .param-grid div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .param-grid dt {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted, #98a6b5);
  }

  .param-grid dd {
    margin: 0;
    font-size: 14px;
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

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .dialog-cancel {
    margin-right: auto;
  }

  sl-dialog::part(header) {
    padding: 6px 10px 0;
  }

  sl-dialog::part(body) {
    padding: 4px 10px 0;
  }

  sl-dialog::part(footer) {
    padding: 4px 10px 8px;
  }

  sl-dialog::part(close-button) {
    display: none;
  }

  sl-button::part(base) {
    border-radius: 10px;
    font-weight: 600;
  }

  .button-icon {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .inline-spinner {
    font-size: 14px;
  }

  .demo-button::part(base) {
    background: transparent;
    border-color: #2b3a4b;
    color: var(--muted, #98a6b5);
    opacity: 0.7;
  }

  .demo-button::part(base):hover {
    opacity: 1;
    border-color: #3a4a5c;
    color: var(--text, #e7edf5);
  }

  sl-input::part(base) {
    border-radius: 10px;
    border-color: #2b3b4c;
    background: #0e141b;
    color: inherit;
  }

  sl-input::part(form-control) {
    gap: 6px;
  }

  .pane-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pane {
    background: var(--panel-strong, #1a2430);
    border-radius: 14px;
    padding: 16px;
    border: 1px solid #2b3a4b;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 200px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    background: #243243;
    color: var(--muted, #98a6b5);
  }

  .status.ok {
    background: rgba(53, 194, 139, 0.18);
    color: #7ef0c3;
  }

  .status.warn {
    background: rgba(255, 180, 84, 0.15);
    color: var(--warn, #ffb454);
  }

  .status.crit {
    background: rgba(255, 102, 102, 0.16);
    color: #ff8a8a;
  }

  .status.wait {
    background: rgba(88, 110, 134, 0.2);
    color: #c0cad6;
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

  .empty-state.stack {
    margin-top: 0;
    padding: 28px;
    min-height: 280px;
    flex-direction: column;
    text-align: center;
    gap: 14px;
    border-style: solid;
    border-color: #2b3a4b;
    background: rgba(10, 16, 22, 0.8);
  }

  .empty-icon {
    width: 120px;
    height: 120px;
    border-radius: 28px;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 30% 30%, #2d3c4c, #121a24);
    border: 1px solid #2b3a4b;
  }

  .empty-icon svg {
    width: 72px;
    height: 72px;
    opacity: 0.9;
  }

  .empty-title {
    margin: 0;
    font-size: 20px;
    color: var(--text, #e7edf5);
  }

  .empty-message {
    margin: 0;
    max-width: 420px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
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
    font-family: var(--mono, Consolas, monospace);
  }

  @media (max-width: 900px) {
    .pane-grid {
      grid-template-columns: 1fr;
    }

    .shell {
      grid-template-columns: 1fr;
    }

    .device-meta {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
    }
  }
`;
