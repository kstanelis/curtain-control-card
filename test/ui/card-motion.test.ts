import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurtainControlCard } from '../../src/curtain-control-card';
import { cardStyles } from '../../src/ui/styles';
import { full, installCardEnv, mount, one, q, resetCardEnv } from '../helpers/card';
import { fakeHass, type FakeHass } from '../helpers/hass';

/** prefers-reduced-motion stand-in whose `matches` and change listeners the test controls. */
let reduced = false;
const listeners = new Set<() => void>();
function fakeMatchMedia(query: string) {
  return {
    media: query,
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
}
function setReduced(v: boolean) {
  reduced = v;
  for (const cb of listeners) cb();
}

const cancels: ReturnType<typeof vi.fn>[] = [];
const animate = vi.fn(() => {
  const cancel = vi.fn();
  cancels.push(cancel);
  return { cancel, finished: new Promise(() => undefined) } as unknown as Animation;
});

beforeEach(() => {
  installCardEnv();
  reduced = false;
  listeners.clear();
  cancels.length = 0;
  animate.mockClear();
  vi.stubGlobal('matchMedia', fakeMatchMedia);
  Element.prototype.animate = animate;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => true;
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  resetCardEnv();
  vi.restoreAllMocks();
});

const opening = () => fakeHass({ 'cover.a': { ...full(40), state: 'opening' } });

async function setState(el: CurtainControlCard, hass: FakeHass, state: string) {
  el.hass = { ...hass, states: { 'cover.a': { ...full(40), entity_id: 'cover.a', state } } };
  await el.updateComplete;
}

describe('moving indicator pulse', () => {
  it('pulses while the cover runs, stops when it stops', async () => {
    const hass = opening();
    const el = await mount({ entities: ['cover.a'] }, hass);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(one(el, 'svg.moving').hasAttribute('data-pulse')).toBe(true);
    await setState(el, hass, 'closing');
    expect(animate).toHaveBeenCalledTimes(1);
    await setState(el, hass, 'open');
    expect(q(el, 'svg.moving')).toBeNull();
    expect(cancels[0]).toHaveBeenCalledTimes(1);
  });

  it('no pulse and no transitions with prefers-reduced-motion', async () => {
    reduced = true;
    const el = await mount({ entities: ['cover.a'] }, opening());
    expect(q(el, 'svg.moving')).not.toBeNull();
    expect(animate).not.toHaveBeenCalled();
    expect(one(el, 'ha-card').classList.contains('reduced')).toBe(true);
    expect(cardStyles.cssText).toMatch(/\.reduced \.fill[^{]*\{[^}]*transition:\s*none/);
  });

  it('follows the preference when it changes', async () => {
    const el = await mount({ entities: ['cover.a'] }, opening());
    setReduced(true);
    await el.updateComplete;
    expect(cancels[0]).toHaveBeenCalledTimes(1);
    setReduced(false);
    await el.updateComplete;
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('dragging hides the indicator and stops its pulse', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      height: 200,
    } as DOMRect);
    const el = await mount({ entities: ['cover.a'] }, opening());
    one(el, '.track').dispatchEvent(
      new PointerEvent('pointerdown', { clientY: 100, pointerId: 1, button: 0 }),
    );
    await el.updateComplete;
    expect(cancels[0]).toHaveBeenCalledTimes(1);
  });

  it('disconnecting stops pulses and the preference listener; reconnecting resumes', async () => {
    const el = await mount({ entities: ['cover.a'] }, opening());
    el.remove();
    expect(cancels[0]).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
    document.body.appendChild(el);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(1);
  });

  it('held keys follow instantly too', async () => {
    const el = await mount({ entities: ['cover.a'] }, opening());
    one(el, '.track').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    await el.updateComplete;
    expect(one(el, '.column').classList.contains('live')).toBe(true);
  });

  it('position changes ease over 150 ms, but not under a finger', () => {
    expect(cardStyles.cssText).toMatch(/\.fill[^{]*\{[^}]*transition:\s*height 150ms/);
    expect(cardStyles.cssText).toMatch(/\.live \.fill[^{]*\{[^}]*transition:\s*none/);
  });
});
