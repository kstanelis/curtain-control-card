import { describe, expect, it } from 'vitest';
import { clampPercent, keyStep, pointerToPercent } from '../../src/model/position';

describe('pointerToPercent', () => {
  const rect = { top: 100, height: 200 };

  it.each([
    [100, 100],
    [300, 0],
    [200, 50],
    [50, 100],
    [350, 0],
    [150.9, 75],
  ])('maps y=%d to %d%% (top = open)', (y, expected) => {
    expect(pointerToPercent(y, rect)).toBe(expected);
  });

  it('returns 0 for a zero-height track instead of NaN', () => {
    expect(pointerToPercent(120, { top: 100, height: 0 })).toBe(0);
  });
});

describe('clampPercent', () => {
  it.each([
    ['42.6', 43],
    [120, 100],
    [-5, 0],
    [65, 65],
  ])('turns %j into %d', (input, expected) => {
    expect(clampPercent(input)).toBe(expected);
  });

  it.each([undefined, null, 'abc', Number.NaN, '', {}])('returns null for %j', (input) => {
    expect(clampPercent(input)).toBeNull();
  });
});

describe('keyStep', () => {
  it.each([
    ['ArrowUp', 50, 55],
    ['ArrowRight', 50, 55],
    ['ArrowDown', 50, 45],
    ['ArrowLeft', 50, 45],
    ['Home', 50, 100],
    ['End', 50, 0],
    ['ArrowUp', 98, 100],
    ['ArrowDown', 3, 0],
  ])('%s from %d gives %d', (key, from, expected) => {
    expect(keyStep(key, from)).toBe(expected);
  });

  it('ignores other keys', () => {
    expect(keyStep('a', 50)).toBeNull();
  });
});
