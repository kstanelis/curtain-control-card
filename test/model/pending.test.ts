import { describe, expect, it } from 'vitest';
import { PendingTargets } from '../../src/model/pending';

const KEY = '0:cover.a';

describe('PendingTargets', () => {
  it('shows the target until the cover is within 1 %', () => {
    const p = new PendingTargets();
    p.set(KEY, 50, 0);
    expect(p.resolve(KEY, 20, 'opening', 1000)).toBe(50);
    expect(p.resolve(KEY, 49, 'opening', 2000)).toBeNull();
    expect(p.resolve(KEY, 20, 'opening', 3000)).toBeNull();
  });

  it('releases when the state leaves opening/closing after entering it', () => {
    const p = new PendingTargets();
    p.set(KEY, 50, 0);
    expect(p.resolve(KEY, 20, 'opening', 100)).toBe(50);
    expect(p.resolve(KEY, 30, 'open', 200)).toBeNull();
  });

  it('keeps the target while the cover has not started moving, up to 30 s', () => {
    const p = new PendingTargets();
    p.set(KEY, 50, 0);
    expect(p.resolve(KEY, 20, 'open', 29_999)).toBe(50);
    expect(p.resolve(KEY, 20, 'open', 30_000)).toBeNull();
  });

  it('treats an unknown current position as not yet reached', () => {
    const p = new PendingTargets();
    p.set(KEY, 50, 0);
    expect(p.resolve(KEY, null, 'open', 10)).toBe(50);
  });

  it('clear drops the target', () => {
    const p = new PendingTargets();
    p.set(KEY, 50, 0);
    p.clear(KEY);
    expect(p.resolve(KEY, 20, 'open', 10)).toBeNull();
  });

  it('returns null for a key it never saw', () => {
    expect(new PendingTargets().resolve('1:cover.b', 20, 'open', 0)).toBeNull();
  });

  it('keeps duplicate entities independent by column key', () => {
    const p = new PendingTargets();
    p.set('0:cover.a', 50, 0);
    expect(p.resolve('1:cover.a', 20, 'open', 10)).toBeNull();
    expect(p.resolve('0:cover.a', 20, 'open', 10)).toBe(50);
  });
});

describe('PendingTargets.clear with a target', () => {
  it('only clears when the target still matches (a late failure must not drop a newer command)', () => {
    const p = new PendingTargets();
    p.set(KEY, 70, 0);
    p.clear(KEY, 40);
    expect(p.resolve(KEY, 20, 'open', 1)).toBe(70);
    p.clear(KEY, 70);
    expect(p.resolve(KEY, 20, 'open', 1)).toBeNull();
  });
});
