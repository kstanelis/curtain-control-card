import { describe, expect, it } from 'vitest';
import { GRID_OPTIONS, LAYOUT_OPTIONS, cardSize } from '../../src/model/sizing';

describe('cardSize (Masonry, spec §7: ceil(heightPx / 50))', () => {
  it.each([
    ['360px', 8],
    ['480px', 10],
    ['50px', 1],
    ['360.5px', 8],
    ['600PX', 12],
    ['.5px', 1],
  ])('%s → %i', (h, n) => {
    expect(cardSize(h)).toBe(n);
  });

  it.each(['50vh', 'calc(100% - 4px)', '', 'px', '0px', '-10px'])(
    'non-px or non-positive %j → default 8',
    (h) => {
      expect(cardSize(h)).toBe(8);
    },
  );
});

describe('cardSize with a measured height (owner, 2026-11-16)', () => {
  it('non-px height uses the measured rendered height', () => {
    expect(cardSize('50vh', 576)).toBe(12);
    expect(cardSize('40rem', 640)).toBe(13);
  });

  it('px height ignores the measurement', () => {
    expect(cardSize('360px', 1000)).toBe(8);
  });

  it('not measured yet (0) → default', () => {
    expect(cardSize('50vh', 0)).toBe(8);
  });
});

describe('Sections grid (spec §7)', () => {
  it('getGridOptions (HA 2024.11+)', () => {
    expect(GRID_OPTIONS).toEqual({ columns: 12, rows: 6, min_columns: 3, min_rows: 4 });
  });

  it('getLayoutOptions (HA 2024.8–2024.10)', () => {
    expect(LAYOUT_OPTIONS).toEqual({
      grid_columns: 4,
      grid_rows: 6,
      grid_min_columns: 1,
      grid_min_rows: 4,
    });
  });
});
