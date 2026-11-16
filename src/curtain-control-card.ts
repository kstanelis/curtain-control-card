import { LitElement, html, nothing, svg, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CARD_TYPE, normalizeConfig, type CardConfig } from './config';
import { relevantChange } from './ha/changes';
import { toCurtains } from './ha/curtains';
import { localize } from './ha/i18n';
import { callCover, type ButtonAction } from './ha/services';
import { entitySuggestion, stubConfig } from './ha/suggest';
import type { HomeAssistant } from './ha/types';
import { columnView, fabricChipEdge, type ColumnView } from './model/column';
import type { Curtain } from './model/curtain';
import { computeLayout, type Layout } from './model/layout';
import { PENDING_HOLD_MS, PendingTargets } from './model/pending';
import { keyStep } from './model/position';
import { GRID_OPTIONS, LAYOUT_OPTIONS, cardSize } from './model/sizing';
import { themeTokens } from './model/theme';
import { supportsColorMix } from './ui/css-support';
import { mdiAlertCircleOutline, mdiArrowDown, mdiArrowUp, mdiStop } from '@mdi/js';
import { syncPulse } from './ui/motion';
import { SliderDrag } from './ui/slider-drag';
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
  @state() private reduced = false;
  private motionQuery?: MediaQueryList;
  /** Indicators pulsing after the last render. */
  private pulsing = new Set<Element>();
  private readonly onMotionPref = (): void => {
    this.reduced = this.motionQuery?.matches ?? false;
  };
  private _hass?: HomeAssistant;
  private observer?: ResizeObserver;
  private observed?: Element;
  private readonly drag = new SliderDrag(
    () => {
      this.requestUpdate();
    },
    (key, v) => {
      this.commit(key, v);
    },
  );
  /** Keyboard value per column key, from the first keydown until the last slider key is up. */
  private readonly keyed = new Map<string, { v: number; held: Set<string> }>();
  private pending = new PendingTargets();
  /** One pending-expiry timer per column key. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Curtains from the last render, by key: commit reads position and state from here. */
  private curtains = new Map<string, Curtain>();
  // Track-independent pointer handlers: SliderDrag matches the event to the active pointer.
  private readonly onPointerMove = (ev: PointerEvent): void => {
    this.drag.move(ev);
  };
  private readonly onPointerUp = (ev: PointerEvent): void => {
    this.drag.up(ev);
  };
  private readonly onPointerCancel = (): void => {
    this.drag.cancel();
  };

  static getStubConfig(hass: HomeAssistant): ReturnType<typeof stubConfig> {
    return stubConfig(hass);
  }

  setConfig(raw: unknown): void {
    const config = normalizeConfig(raw, { allowEmpty: true });
    // Column keys are `${index}:${entity}`: when the entity list changes a key may name another
    // column, so drop gestures and targets. Other edits (height, theme…) keep them.
    const ids = (c?: CardConfig) => c?.entities.map((e) => e.entity).join('\n');
    if (ids(config) !== ids(this.config)) this.resetInteraction();
    this.config = config;
  }

  private resetInteraction(): void {
    this.drag.cancel();
    this.keyed.clear();
    this.pending = new PendingTargets();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
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
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionQuery.addEventListener('change', this.onMotionPref);
    this.reduced = this.motionQuery.matches;
    if (this.hasUpdated) this.syncPulses(); // disconnect cancelled them; DOM is unchanged
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.drag.cancel();
    this.keyed.clear();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.motionQuery?.removeEventListener('change', this.onMotionPref);
    for (const el of this.pulsing) syncPulse(el, false, this.reduced);
    this.pulsing.clear();
  }

  /** ha-card exists only once config is set, which may be after the first render. */
  protected override updated(): void {
    this.observeCard();
    this.syncPulses();
  }

  /** The indicator is rendered only while its cover runs, so presence means running. */
  private syncPulses(): void {
    const now = new Set<Element>(this.shadowRoot?.querySelectorAll('svg.moving') ?? []);
    for (const el of this.pulsing) if (!now.has(el)) syncPulse(el, false, this.reduced);
    for (const el of now) syncPulse(el, true, this.reduced);
    this.pulsing = now;
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
    const classes = {
      [config.style]: true,
      forced: config.theme !== 'auto',
      reduced: this.reduced,
    };
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
    const now = Date.now();
    const curtains = toCurtains(hass, config.entities);
    this.curtains = new Map(curtains.map((c) => [c.key, c]));
    const views = curtains.map((c) =>
      columnView(
        c,
        this.drag.value(c.key) ??
          this.keyed.get(c.key)?.v ??
          this.pending.resolve(c.key, c.position, c.state, now),
      ),
    );
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
    const dragging = this.drag.value(v.key) !== null;
    const classes = {
      column: true,
      compact: layout.compact,
      [layout.buttons]: true,
      [v.status]: true,
      dragging,
      live: dragging || this.keyed.has(v.key),
    };
    const readout = html`${
        v.moving && !dragging
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
      tabindex=${ifDefined(v.interactive ? 0 : undefined)}
      @pointerdown=${(ev: PointerEvent) => {
        if (v.interactive && !this.keyed.has(v.key)) {
          this.drag.down(v.key, ev, ev.currentTarget as HTMLElement);
        }
      }}
      @pointermove=${this.onPointerMove}
      @pointerup=${this.onPointerUp}
      @pointercancel=${this.onPointerCancel}
      @lostpointercapture=${this.onPointerCancel}
      @keydown=${(ev: KeyboardEvent) => {
        this.keyDown(v, ev);
      }}
      @keyup=${(ev: KeyboardEvent) => {
        this.keyUp(v, ev);
      }}
      @blur=${() => {
        // A held key whose keyup never arrives (focus moved away): revert, send nothing.
        if (this.keyed.delete(v.key)) this.requestUpdate();
      }}
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
          this.press(action, v);
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

  private press(action: ButtonAction, v: ColumnView): void {
    if (!this._hass) return;
    this.pending.clear(v.key);
    this.requestUpdate();
    // HA already shows a toast for a failed service call; don't leave the rejection unhandled.
    callCover(this._hass, action, v.entityId).catch(() => undefined);
  }

  /** Keyboard: step on keydown (auto-repeat included), one command once all keys are up. */
  private keyDown(v: ColumnView, ev: KeyboardEvent): void {
    if (!v.interactive || this.drag.value(v.key) !== null) return;
    const next = keyStep(ev.key, v.fill);
    if (next === null) return;
    ev.preventDefault();
    const held = this.keyed.get(v.key)?.held ?? new Set<string>();
    held.add(ev.key);
    this.keyed.set(v.key, { v: next, held });
    this.requestUpdate();
  }

  private keyUp(v: ColumnView, ev: KeyboardEvent): void {
    const k = this.keyed.get(v.key);
    if (!k?.held.delete(ev.key) || k.held.size > 0) return;
    this.keyed.delete(v.key);
    this.commit(v.key, k.v);
  }

  /** Release of a drag or key: exactly one set_cover_position. */
  private commit(key: string, v: number): void {
    this.requestUpdate();
    const hass = this._hass;
    const curtain = this.curtains.get(key);
    if (!hass || !curtain?.features.setPosition) return;
    // Always resend: some covers never report opening/closing, so "already there" can't be trusted.
    this.pending.set(key, v, Date.now());
    clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.requestUpdate();
      }, PENDING_HOLD_MS),
    );
    const pending = this.pending;
    callCover(hass, 'set', curtain.entityId, v).catch(() => {
      pending.clear(key, v); // only this command's target; a newer one stays
      this.requestUpdate();
    });
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
