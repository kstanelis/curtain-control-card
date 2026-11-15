import type { CardStyle } from '../config';

export type ButtonPlacement = 'row' | 'side' | 'stacked';

export interface Layout {
  rows: 1 | 2;
  perRow: number;
  colW: number;
  rowH: number;
  compact: boolean;
  buttons: ButtonPlacement;
  sizes: { name: number; pct: number; btn: number; header: number };
}

// Spec §4 "Layout" — keep in sync with the canvas Card.dc.html renderVals().
const PAD = 16;
const GAP_X = 8;
const GAP_Y = 12;
const WRAP_BELOW = 72;
const COMPACT_BELOW = 140;
const PILL_ROW_MIN = 164;
const FABRIC_SIDE_MIN = 200;
const BUTTON_GAP_TOTAL = 12; // two 6 px gaps between three stacked buttons
const TRACK_MIN_STACKED = 64;
const BODY_GAPS = 16;

const columnWidth = (width: number, perRow: number): number =>
  Math.max(0, (width - 2 * PAD - GAP_X * (perRow - 1)) / perRow);

/** Rows, column sizes and button placement for n curtains in a width × height card. */
export function computeLayout(n: number, width: number, height: number, style: CardStyle): Layout {
  const count = Math.max(1, n);
  let rows: 1 | 2 = 1;
  let perRow = count;
  let colW = columnWidth(width, perRow);
  if (colW < WRAP_BELOW && count > 1) {
    rows = 2;
    perRow = Math.ceil(count / 2);
    colW = columnWidth(width, perRow);
  }
  const rowH = Math.max(0, (height - 2 * PAD - GAP_Y * (rows - 1)) / rows);
  const compact = colW < COMPACT_BELOW;
  const isPill = style === 'pill';

  const btn = compact ? 40 : 48;
  const header = isPill ? (compact ? 44 : 36) : 22;
  const sizes = compact ? { name: 13, pct: 20, btn, header } : { name: 16, pct: 28, btn, header };

  let buttons: ButtonPlacement = 'stacked';
  if (!isPill && colW >= FABRIC_SIDE_MIN) buttons = 'side';
  else if (isPill && colW >= PILL_ROW_MIN) buttons = 'row';
  else if (rowH < header + 3 * btn + BUTTON_GAP_TOTAL + TRACK_MIN_STACKED + BODY_GAPS) {
    buttons = 'row';
  }

  return { rows, perRow, colW, rowH, compact, buttons, sizes };
}
