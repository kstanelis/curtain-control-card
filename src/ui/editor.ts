import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { normalizeConfig, type CardConfig } from '../config';
import { entityName } from '../ha/curtains';
import { editorSchema, type FormSection } from '../ha/editor-schema';
import { localize, type TKey } from '../ha/i18n';
import type { HomeAssistant } from '../ha/types';
import { NAME_FIELD, formCanShow, fromForm, toForm, type FormData } from '../model/editor-form';

export const EDITOR_TYPE = 'curtain-control-card-editor';

const LABELS: Partial<Record<string, TKey>> = {
  entity_ids: 'editor.entities',
  style: 'editor.style',
  theme: 'editor.theme',
  height: 'editor.height',
  accent: 'editor.accent',
};

export class CurtainControlCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: CardConfig;
  private form: FormData = {};
  private schema?: { key: string; value: FormSection[] };

  /** Throws for a config the form can't represent; HA then shows the code editor. */
  setConfig(raw: unknown): void {
    const config = normalizeConfig(raw, { allowEmpty: true });
    if (!formCanShow(config)) {
      throw new Error('One entity has two different names; edit it in YAML');
    }
    this.use(config);
  }

  private use(config: CardConfig): void {
    this.config = config;
    this.form = toForm(config);
  }

  protected override render(): TemplateResult | typeof nothing {
    const { hass, config } = this;
    if (!hass || !config) return nothing;
    return html`<ha-form
      .hass=${hass}
      .data=${this.form}
      .schema=${this.schemaFor(hass, config)}
      .computeLabel=${this.label}
      @value-changed=${this.changed}
    ></ha-form>`;
  }

  /** Rebuilt only when the entity list, their HA names or the language change. */
  private schemaFor(hass: HomeAssistant, config: CardConfig): FormSection[] {
    const ids = config.entities.map((e) => e.entity);
    const haNames = Object.fromEntries(ids.map((id) => [id, entityName(hass, id)]));
    const key = JSON.stringify([hass.locale?.language, haNames, ids]);
    if (this.schema?.key !== key) {
      this.schema = { key, value: editorSchema(ids, haNames, (k) => localize(hass, k)) };
    }
    return this.schema.value;
  }

  private readonly label = (schema: { name: string }): string => {
    if (schema.name.startsWith(NAME_FIELD)) {
      return `${localize(this.hass, 'editor.name')} · ${schema.name.slice(NAME_FIELD.length)}`;
    }
    const key = LABELS[schema.name];
    return key ? localize(this.hass, key) : schema.name;
  };

  private readonly changed = (ev: CustomEvent<{ value: FormData }>): void => {
    ev.stopPropagation();
    if (!this.config) return;
    const config = fromForm(this.config, ev.detail.value);
    try {
      this.use(normalizeConfig(config, { allowEmpty: true }));
    } catch {
      // HA hands the config back through setConfig, which throws and opens the code editor.
    }
    this.dispatchEvent(
      new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }),
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'curtain-control-card-editor': CurtainControlCardEditor;
  }
}

if (!customElements.get(EDITOR_TYPE)) customElements.define(EDITOR_TYPE, CurtainControlCardEditor);
