import { LitElement, css, html } from "lit";

export type TuneDeltaEventDetail = {
  delta: number;
};

export class TuneControls extends LitElement {
  static properties = {
    disabled: { type: Boolean },
    testIdPrefix: { type: String, attribute: "test-id-prefix" },
    label: { type: String },
  };

  declare disabled: boolean;
  declare testIdPrefix: string;
  declare label: string;

  private readonly steps = [10, 5, 1, 0.2] as const;

  static styles = css`
    :host {
      display: contents;
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
      align-self: center;
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
  `;

  constructor() {
    super();
    this.disabled = false;
    this.testIdPrefix = "tune";
    this.label = "tune";
  }

  render() {
    return html`
      <div class="absolute-group" role="group" aria-label="Decrease absolute">
        ${this.steps.map(
          (step) => html`
            <sl-button
              class="absolute-step"
              data-test-id=${`${this.testIdPrefix}-decrease-${this.getStepToken(step)}`}
              size="small"
              ?disabled=${this.disabled}
              @click=${() => this.emitDelta(-step)}
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
      <div class="absolute-center">${this.label}</div>
      <div class="absolute-group" role="group" aria-label="Increase absolute">
        ${[...this.steps].reverse().map(
          (step) => html`
            <sl-button
              class="absolute-step"
              data-test-id=${`${this.testIdPrefix}-increase-${this.getStepToken(step)}`}
              size="small"
              ?disabled=${this.disabled}
              @click=${() => this.emitDelta(step)}
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

  private emitDelta(delta: number) {
    this.dispatchEvent(
      new CustomEvent<TuneDeltaEventDetail>("tune-delta", {
        detail: { delta },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getStepToken(step: number) {
    return step.toString().replace(".", "-");
  }
}

if (!customElements.get("tune-controls")) {
  customElements.define("tune-controls", TuneControls);
}

export {};
