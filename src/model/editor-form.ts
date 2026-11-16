import { DEFAULTS, MAX_ENTITIES, type CardConfig } from '../config';

/** Flat ha-form data: `entity_ids`, `name:<entity id>`, style, theme, height, accent. */
export type FormData = Record<string, unknown>;

/** Form key prefix of a per-cover name field: `name:<entity id>`. */
export const NAME_FIELD = 'name:';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The form keys names by entity id, so one entity listed twice cannot carry two names. */
export function formCanShow(config: CardConfig): boolean {
  const names = new Map<string, string | undefined>();
  return config.entities.every((e) => {
    if (!names.has(e.entity)) names.set(e.entity, e.name);
    return names.get(e.entity) === e.name;
  });
}

export function toForm(config: CardConfig): FormData {
  const data: FormData = {
    entity_ids: config.entities.map((e) => e.entity),
    style: config.style,
    theme: config.theme,
  };
  for (const e of config.entities) {
    if (e.name) data[`${NAME_FIELD}${e.entity}`] = e.name;
  }
  if (config.height !== DEFAULTS.height) data.height = config.height;
  if (config.accent) data.accent = config.accent;
  return data;
}

/** Config to save: defaults and empty values left out, unknown keys from `prev` kept. */
export function fromForm(prev: CardConfig, data: FormData): Record<string, unknown> {
  const ids = (Array.isArray(data.entity_ids) ? (data.entity_ids as unknown[]) : [])
    .filter((id): id is string => typeof id === 'string' && id !== '')
    .slice(0, MAX_ENTITIES);
  const out: Record<string, unknown> = { ...prev };
  out.entities = ids.map((entity) => {
    const name = str(data[`${NAME_FIELD}${entity}`]);
    return name ? { entity, name } : entity;
  });
  const set = (key: string, value: string, fallback?: string) => {
    if (value && value !== fallback) out[key] = value;
    else Reflect.deleteProperty(out, key);
  };
  set('style', str(data.style), DEFAULTS.style);
  set('theme', str(data.theme), DEFAULTS.theme);
  set('height', str(data.height), DEFAULTS.height);
  set('accent', str(data.accent));
  return out;
}
