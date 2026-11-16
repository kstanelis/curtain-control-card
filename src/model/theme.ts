import type { ThemeMode } from '../config';

/** CSS custom properties set on the card root; markup uses only `var(--cc-*)`. */
export type Tokens = Record<`--cc-${string}`, string>;

interface Palette {
  card: string;
  text: string;
  muted: string;
  border: string;
  /** Precomputed track/button for engines without color-mix (card mixed 12 % / 7 % toward text). */
  track: string;
  button: string;
}

const DEFAULT_ACCENT = '#03a9f4';
const WINDOW = '#5b8db8';

/** Forced palettes. */
export const PALETTES: Readonly<Record<'dark' | 'light', Palette>> = {
  dark: {
    card: '#1c1c1c',
    text: '#e1e1e1',
    muted: '#9b9b9b',
    border: '#2f2f2f',
    track: '#343434',
    button: '#2a2a2a',
  },
  light: {
    card: '#ffffff',
    text: '#212121',
    muted: '#727272',
    border: '#e0e0e0',
    track: '#e4e4e4',
    button: '#efefef',
  },
};

const HA_SURFACE = 'var(--secondary-background-color, #e5e5e5)';

/** `auto` follows the HA theme variables. */
const AUTO: Palette = {
  // Not --ha-card-background: custom themes may set it to a gradient/image, which breaks color-mix.
  card: 'var(--card-background-color, #fff)',
  text: 'var(--primary-text-color, #212121)',
  muted: 'var(--secondary-text-color, #727272)',
  border: 'var(--divider-color, #e0e0e0)',
  track: HA_SURFACE,
  button: HA_SURFACE,
};

/** Semantic colours that never follow theme or accent. */
const FIXED = {
  '--cc-fabric-a': '#d8c7a8',
  '--cc-fabric-b': '#c4b190',
  '--cc-handle': '#f4efe6',
  '--cc-chip-bg': 'rgba(0,0,0,0.6)',
  '--cc-chip-text': '#ffffff',
};

const MIXED = {
  '--cc-track': 'color-mix(in srgb, var(--cc-card), var(--cc-text) 12%)',
  '--cc-button': 'color-mix(in srgb, var(--cc-card), var(--cc-text) 7%)',
  '--cc-accent-text': 'color-mix(in srgb, var(--cc-accent), var(--cc-text) 45%)',
  '--cc-accent-tint': 'color-mix(in srgb, var(--cc-card), var(--cc-accent) 25%)',
  '--cc-on-accent': 'color-mix(in srgb, var(--cc-accent), #000 55%)',
  '--cc-window': `color-mix(in srgb, var(--cc-card), ${WINDOW} 35%)`,
};

/** Token map for the card root: palette, derived tokens, color-mix fallback. */
export function themeTokens(
  mode: ThemeMode,
  accent: string | undefined,
  colorMix: boolean,
): Tokens {
  const p = mode === 'auto' ? AUTO : PALETTES[mode];
  const fallbackAccent =
    mode === 'auto' ? `var(--primary-color, ${DEFAULT_ACCENT})` : DEFAULT_ACCENT;
  const derived = colorMix
    ? MIXED
    : {
        '--cc-track': p.track,
        '--cc-button': p.button,
        '--cc-accent-text': 'var(--cc-text)',
        '--cc-accent-tint': 'var(--cc-border)',
        '--cc-on-accent': 'rgba(0,0,0,0.45)',
        '--cc-window': WINDOW,
      };
  return {
    '--cc-card': p.card,
    '--cc-text': p.text,
    '--cc-muted': p.muted,
    '--cc-border': p.border,
    '--cc-accent': accent ?? fallbackAccent,
    ...derived,
    ...FIXED,
  };
}
