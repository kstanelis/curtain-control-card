import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/model/layout';

describe('computeLayout', () => {
  it('4 pill curtains in a Masonry column: one compact row, buttons stacked', () => {
    const l = computeLayout(4, 440, 360, 'pill');
    expect(l.rows).toBe(1);
    expect(l.perRow).toBe(4);
    expect(l.colW).toBeCloseTo(96);
    expect(l.rowH).toBeCloseTo(328);
    expect(l.compact).toBe(true);
    expect(l.buttons).toBe('stacked');
    expect(l.sizes).toEqual({ name: 13, pct: 20, btn: 40, header: 44 });
  });

  it('8 fabric curtains in a Masonry column wrap to 2 rows of 4', () => {
    const l = computeLayout(8, 440, 704, 'fabric');
    expect(l.rows).toBe(2);
    expect(l.perRow).toBe(4);
    expect(l.colW).toBeCloseTo(96);
    expect(l.rowH).toBeCloseTo(330);
    expect(l.buttons).toBe('stacked');
    expect(l.sizes.header).toBe(22);
  });

  it('forces a button row when the row is too short to stack', () => {
    const l = computeLayout(8, 440, 360, 'pill');
    expect(l.rows).toBe(2);
    expect(l.rowH).toBeCloseTo(158);
    expect(l.buttons).toBe('row');
  });

  it('wide pill columns use normal sizes and a button row', () => {
    const l = computeLayout(4, 1376, 360, 'pill');
    expect(l.colW).toBeCloseTo(330);
    expect(l.compact).toBe(false);
    expect(l.buttons).toBe('row');
    expect(l.sizes).toEqual({ name: 16, pct: 28, btn: 48, header: 36 });
  });

  it('wide fabric columns put buttons at the side', () => {
    expect(computeLayout(4, 1376, 360, 'fabric').buttons).toBe('side');
  });

  it('wraps an odd count into rows of ceil(n/2)', () => {
    const l = computeLayout(5, 300, 360, 'pill');
    expect(l.rows).toBe(2);
    expect(l.perRow).toBe(3);
    expect(l.colW).toBeCloseTo(84);
  });

  it('never wraps a single curtain', () => {
    const l = computeLayout(1, 50, 360, 'pill');
    expect(l.rows).toBe(1);
    expect(l.perRow).toBe(1);
  });

  it.each([
    [4, 0, 0, 'pill'],
    [8, 0, 360, 'fabric'],
  ] as const)('stays finite and non-negative at %i x %i x %i', (n, w, h, style) => {
    const l = computeLayout(n, w, h, style);
    for (const v of [l.colW, l.rowH, l.perRow, ...Object.values(l.sizes)]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
