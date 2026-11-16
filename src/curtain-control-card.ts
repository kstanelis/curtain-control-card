import { LitElement, html, nothing, svg, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CARD_TYPE, normalizeConfig, type CardConfig } from './config';
import { relevantChange } from './ha/changes';
import { toCurtains } from './ha/curtains';
import { localize } from './ha/i18n';
import { callCover, type ButtonAction } from './ha/services';
import { entitySuggestion, stubConfig } from './ha/suggest';
import type { HomeAssistant } from './ha/types';
import { columnView, fabricChipEdge, type ColumnView } from './model/column';
import { computeLayout, type Layout } from './model/layout';
import { GRID_OPTIONS, LAYOUT_OPTIONS, cardSize } from './model/sizing';
import { themeTokens } from './model/theme';
import { supportsColorMix } from './ui/css-support';
import { mdiAlertCircleOutline, mdiArrowDown, mdiArrowUp, mdiStop } from '@mdi/js';
import { cardStyles } from './ui/styles';

/** Probed once per page: the engine's color-mix support never changes. */
const COLOR_MIX = supportsColorMix();

const icon = (path: string, size: number, cls?: string, motion?: string): TemplateResult =>
  html`<svg
    class=${cls ?? nothing}
    data-motion=${motion ?? nothing}
    aria-hidden="true"
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
  >
    ${svg`<path d=${path}></path>`}
  </svg>`;

export class CurtainControlCard extends LitElement {
  static override styles = cardStyles;

  /** Set by HA: 'grid' in Sections, undefined in Masonry; may change after the first render. */
  @property({ attribute: false }) layout?: string;

  @state() private config?: CardConfig;
  @state() private size = { w: 0, h: 0 };
  private _hass?: HomeAssistant;
  private observer?: ResizeObserver;
  private observed?: Element;

  static getStubConfig(hass: HomeAssistant): ReturnType<typeof stubConfig> {
    return stubConfig(hass);
  }

  setConfig(raw: unknown): void {
    this.config = normalizeConfig(raw, { allowEmpty: true });
  }

  set hass(next: HomeAssistant | undefined) {
    const old = this._hass;
    this._hass = next;
    const ids = this.config?.entities.map((e) => e.entity) ?? [];
    if (next && relevantChange(old, next, ids)) this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  getCardSize(): number {
    return cardSize(this.config?.height ?? '', this.size.h);
  }

  getGridOptions(): Record<string, number> {
    return { ...GRID_OPTIONS };
  }

  getLayoutOptions(): Record<string, number> {
    return { ...LAYOUT_OPTIONS };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.observer = new ResizeObserver((entries) => {
      const el = entries[0]?.target as HTMLElement | undefined;
      if (el && (el.clientWidth !== this.size.w || el.clientHeight !== this.size.h)) {
        this.size = { w: el.clientWidth, h: el.clientHeight };
      }
    });
    this.observed = undefined;
    this.observeCard();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  /** ha-card exists only once config is set, which may be after the first render. */
  protected override updated(): void {
    this.observeCard();
  }

  private observeCard(): void {
    const card = this.shadowRoot?.querySelector('ha-card');
    if (card && card !== this.observed) {
      this.observed = card;
      this.observer?.observe(card);
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    const config = this.config;
    if (!config) return nothing;
    const tokens = themeTokens(config.theme, config.accent, COLOR_MIX);
    const cardStyle = {
      ...tokens,
      height: this.layout === 'grid' ? '100%' : config.height,
    };
    const classes = { [config.style]: true, forced: config.theme !== 'auto' };
    const hass = this._hass;
    return html`<ha-card class=${classMap(classes)} style=${styleMap(cardStyle)}>
      ${
        config.entities.length === 0
          ? this.renderHint()
          : hass && this.size.w > 0 // wait for the first measurement: no 0-px layout flash
            ? this.renderGrid(config, hass)
            : nothing
      }
    </ha-card>`;
  }

  private renderHint(): TemplateResult {
    return html`<div class="hint">
      ${icon(mdiAlertCircleOutline, 32)}
      <div class="title">${localize(this._hass, 'card.no_curtains')}</div>
      <div class="help">${localize(this._hass, 'card.no_curtains_help')}</div>
    </div>`;
  }

  private renderGrid(config: CardConfig, hass: HomeAssistant): TemplateResult {
    const layout = computeLayout(config.entities.length, this.size.w, this.size.h, config.style);
    const views = toCurtains(hass, config.entities).map((c) => columnView(c, null));
    const gridStyle = {
      gridTemplateColumns: `repeat(${String(layout.perRow)}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${String(layout.rows)}, minmax(0, 1fr))`,
      '--cc-sz-name': `${String(layout.sizes.name)}px`,
      '--cc-sz-pct': `${String(layout.sizes.pct)}px`,
      '--cc-sz-chip': `${String(layout.sizes.chip)}px`,
      '--cc-sz-btn': `${String(layout.sizes.btn)}px`,
      '--cc-sz-header': `${String(layout.sizes.header)}px`,
    };
    return html`<div class="grid" style=${styleMap(gridStyle)}>
      ${views.map((v) => this.renderColumn(v, layout, config.style === 'pill'))}
    </div>`;
  }

  private renderColumn(v: ColumnView, layout: Layout, pill: boolean): TemplateResult {
    const classes = {
      column: true,
      compact: layout.compact,
      [layout.buttons]: true,
      [v.status]: true,
    };
    const readout = html`${
        v.moving
          ? icon(v.moving === 'up' ? mdiArrowUp : mdiArrowDown, pill ? 18 : 16, 'moving', v.moving)
          : nothing
      }<span>${v.readout}</span>`;
    return html`<div class=${classMap(classes)} data-key=${v.key}>
      <div class="header">
        <button
          class="name"
          @click=${() => {
            this.moreInfo(v.entityId);
          }}
        >
          ${v.name}
        </button>
        ${pill ? html`<div class="readout">${readout}</div>` : nothing}
      </div>
      <div class="body">${this.renderTrack(v, pill, readout)} ${this.renderButtons(v)}</div>
    </div>`;
  }

  private renderTrack(v: ColumnView, pill: boolean, readout: TemplateResult): TemplateResult {
    const label = `${v.name} ${localize(this._hass, 'card.position')}`;
    let inner: TemplateResult | typeof nothing = nothing;
    if (v.status === 'unavailable') {
      inner = html`<span class="unavailable-label"
        >${localize(this._hass, 'card.unavailable')}</span
      >`;
    } else if (pill) {
      inner = html`<span
        class=${v.interactive ? 'fill handle' : 'fill'}
        style=${styleMap({ height: `${String(v.fill)}%` })}
      >
        ${v.interactive ? html`<span class="bar"></span>` : nothing}
      </span>`;
    } else {
      const closed = `${String(100 - v.fill)}%`;
      inner = html`<span class="fabric-cloth" style=${styleMap({ height: closed })}></span>
        ${
          v.interactive
            ? html`<span class="fabric-edge" style=${styleMap({ top: closed })}
                ><span class="fabric-handle"></span
              ></span>`
            : nothing
        }
        <span class="chip-row ${fabricChipEdge(v)}"
          ><span class="chip readout">${readout}</span></span
        >`;
    }
    return html`<div
      class="track"
      role="slider"
      aria-label=${label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${v.fill}
      aria-valuetext=${v.readout}
      aria-readonly=${v.interactive ? 'false' : 'true'}
      aria-disabled=${v.disabled ? 'true' : 'false'}
    >
      ${inner}
    </div>`;
  }

  private renderButtons(v: ColumnView): TemplateResult | typeof nothing {
    const { open, stop, close } = v.buttons;
    if (!open && !stop && !close) return nothing;
    const button = (action: ButtonAction, path: string, size: number): TemplateResult =>
      html`<button
        class=${action}
        aria-label=${localize(this._hass, `card.${action}`)}
        ?disabled=${v.disabled}
        @click=${() => {
          this.press(action, v.entityId);
        }}
      >
        ${icon(path, size)}
      </button>`;
    return html`<div class="buttons">
      ${open ? button('open', mdiArrowUp, 22) : nothing}
      ${stop ? button('stop', mdiStop, 20) : nothing}
      ${close ? button('close', mdiArrowDown, 22) : nothing}
    </div>`;
  }

  private press(action: ButtonAction, entityId: string): void {
    if (!this._hass) return;
    // HA already shows a toast for a failed service call; don't leave the rejection unhandled.
    callCover(this._hass, action, entityId).catch(() => undefined);
  }

  private moreInfo(entityId: string): void {
    this.dispatchEvent(
      new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }),
    );
  }
}

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
  getEntitySuggestion?: typeof entitySuggestion;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
  interface HTMLElementTagNameMap {
    'curtain-control-card': CurtainControlCard;
  }
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, CurtainControlCard);
  window.customCards ??= [];
  window.customCards.push({
    type: CARD_TYPE,
    name: 'Curtain Control Card',
    description: 'Control 1–8 curtains with vertical sliders.',
    preview: true,
    getEntitySuggestion: entitySuggestion,
  });
}
