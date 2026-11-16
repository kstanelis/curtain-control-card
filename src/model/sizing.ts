import { DEFAULTS } from '../config';

const ROW_PX = 50;

const px = (height: string): number => {
  const m = /^(\d*\.?\d+)px$/i.exec(height.trim());
  return m ? Number(m[1]) : 0;
};

const DEFAULT_SIZE = Math.ceil(px(DEFAULTS.height) / ROW_PX);

/** Masonry `getCardSize()`: ceil(heightPx / 50); non-px heights use the default height's size. */
export function cardSize(height: string): number {
  const h = px(height);
  return h > 0 ? Math.ceil(h / ROW_PX) : DEFAULT_SIZE;
}

/** Sections `getGridOptions()` (HA 2024.11+). */
export const GRID_OPTIONS = { columns: 12, rows: 6, min_columns: 3, min_rows: 4 } as const;

/** Sections `getLayoutOptions()` (HA 2024.8–2024.10). */
export const LAYOUT_OPTIONS = {
  grid_columns: 4,
  grid_rows: 6,
  grid_min_columns: 1,
  grid_min_rows: 4,
} as const;
