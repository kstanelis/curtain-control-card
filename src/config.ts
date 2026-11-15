export type CardStyle = 'pill' | 'fabric';
export type ThemeMode = 'auto' | 'light' | 'dark';

export interface EntityConf {
  entity: string;
  name?: string;
}

export interface CardConfig {
  type: string;
  entities: EntityConf[];
  style: CardStyle;
  theme: ThemeMode;
  height: string;
  accent?: string;
  [key: string]: unknown;
}

export const MAX_ENTITIES = 8;

export const DEFAULTS = { style: 'pill', theme: 'auto', height: '360px' } as const;

const STYLES: readonly string[] = ['pill', 'fabric'];
const THEMES: readonly string[] = ['auto', 'light', 'dark'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function normalizeEntity(item: unknown): EntityConf {
  const raw = typeof item === 'string' ? { entity: item } : item;
  if (!isRecord(raw) || typeof raw.entity !== 'string' || raw.entity === '') {
    throw new Error('Each entity needs an entity id');
  }
  if (!raw.entity.startsWith('cover.')) {
    throw new Error(`Only cover entities are supported: ${raw.entity}`);
  }
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  return name ? { entity: raw.entity, name } : { entity: raw.entity };
}

/** Validate a raw card config and fill defaults. Throws an Error with a user-facing message. */
export function normalizeConfig(raw: unknown, opts: { allowEmpty?: boolean } = {}): CardConfig {
  if (!isRecord(raw)) throw new Error('Invalid configuration');
  const list = Array.isArray(raw.entities) ? (raw.entities as unknown[]) : [];
  if (list.length === 0 && !opts.allowEmpty) throw new Error('Add at least one cover entity');
  if (list.length > MAX_ENTITIES) {
    throw new Error(`At most ${String(MAX_ENTITIES)} entities are supported`);
  }

  const style = raw.style ?? DEFAULTS.style;
  if (typeof style !== 'string' || !STYLES.includes(style)) {
    throw new Error('style must be pill or fabric');
  }
  const theme = raw.theme ?? DEFAULTS.theme;
  if (typeof theme !== 'string' || !THEMES.includes(theme)) {
    throw new Error('theme must be auto, light or dark');
  }
  const height =
    typeof raw.height === 'number'
      ? `${String(raw.height)}px`
      : typeof raw.height === 'string' && raw.height.trim() !== ''
        ? raw.height
        : DEFAULTS.height;

  return {
    ...raw,
    type: typeof raw.type === 'string' ? raw.type : '',
    entities: list.map(normalizeEntity),
    style: style as CardStyle,
    theme: theme as ThemeMode,
    height,
  };
}
