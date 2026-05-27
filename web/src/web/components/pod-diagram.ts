import { LitElement, css, html, svg } from "lit";
import type { ButtonPosition } from "lib/pod-models";

const defaultPodImageUrl = new URL("../images/pod.png", import.meta.url).href;

export class PodDiagram extends LitElement {
  static properties = {
    positions: { type: Array },
    imageUrl: { type: String },
  };

  declare positions: ButtonPosition[];
  declare imageUrl: string | undefined;

  constructor() {
    super();
    this.positions = [];
  }

  private anchors: Record<string, { x: number; y: number }> = {};
  private resizeObserver?: ResizeObserver;

  static styles = css`
    :host { display: block; }

    .pod-image-wrap {
      position: relative;
    }

    .pod-image-wrap img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 18px;
    }

    .pod-leader-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }

    .pod-leader-line {
      stroke: rgba(140, 255, 200, 0.75);
      stroke-width: 1.2;
      stroke-dasharray: 2 2;
      fill: none;
    }

    .pod-slot {
      position: absolute;
    }

    .pod-slot:empty { display: none; }

    .pod-button-tune { top: 4%; left: 4%; }
    .pod-button-up   { top: 4%; right: 4%; }
    .pod-button-down  { bottom: -2%; right: 4%; }
    .pod-button-pair  { bottom: -2%; left: 4%; }
  `;

  render() {
    const imgSrc = this.imageUrl ?? defaultPodImageUrl;
    return html`
      <div class="pod-image-wrap">
        <img src=${imgSrc} alt="Pod" @load=${this.measureAnchors} />
        <svg class="pod-leader-svg" viewBox="0 0 100 100"
             preserveAspectRatio="none" aria-hidden="true">
          ${this.positions.map((pos) => {
            const slotEdge = this.anchors[pos.cssClass] ?? this.slotEdgeForPosition(pos);
            return svg`<line class="pod-leader-line"
              x1=${slotEdge.x} y1=${slotEdge.y}
              x2=${pos.anchorPct.x} y2=${pos.anchorPct.y} />`;
          })}
        </svg>
        ${this.positions.map((pos) => html`
          <div class="pod-slot ${pos.cssClass}">
            <slot name=${pos.name}></slot>
          </div>
        `)}
      </div>
    `;
  }

  private slotEdgeForPosition(pos: ButtonPosition) {
    const edges: Record<string, { x: number; y: number }> = {
      "pod-button-tune": { x: 20, y: 8 },
      "pod-button-up":   { x: 80, y: 8 },
      "pod-button-down":  { x: 85, y: 95 },
      "pod-button-pair":  { x: 20, y: 95 },
    };
    return edges[pos.cssClass] ?? pos.anchorPct;
  }

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.measureAnchors());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  protected updated() {
    const wrap = this.renderRoot.querySelector<HTMLElement>(".pod-image-wrap");
    if (wrap && this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(wrap);
    }
    this.measureAnchors();
  }

  private measureAnchors = () => {
    const wrap = this.renderRoot.querySelector<HTMLElement>(".pod-image-wrap");
    if (!wrap) return;
    const w = wrap.getBoundingClientRect();
    if (w.width === 0 || w.height === 0) return;
    let changed = false;
    for (const pos of this.positions) {
      const el = this.renderRoot.querySelector<HTMLElement>(`.${pos.cssClass}`);
      if (!el) continue;
      const p = el.getBoundingClientRect();
      const x = ((p.left + p.width / 2) - w.left) / w.width * 100;
      const y = ((p.top + p.height / 2) - w.top) / w.height * 100;
      const prev = this.anchors[pos.cssClass];
      if (!prev || Math.abs(x - prev.x) > 0.1 || Math.abs(y - prev.y) > 0.1) {
        this.anchors[pos.cssClass] = { x, y };
        changed = true;
      }
    }
    if (changed) this.requestUpdate();
  };
}

if (!customElements.get("pod-diagram")) {
  customElements.define("pod-diagram", PodDiagram);
}
