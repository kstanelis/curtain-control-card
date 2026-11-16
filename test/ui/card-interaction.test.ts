import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurtainControlCard } from '../../src/curtain-control-card';
import { PENDING_HOLD_MS } from '../../src/model/pending';
import { cardStyles } from '../../src/ui/styles';
import { full, installCardEnv, mount, one, q, qa, resetCardEnv } from '../helpers/card';
import { fakeHass, type FakeHass } from '../helpers/hass';

const capture = vi.fn();
beforeEach(() => {
  capture.mockClear();
  installCardEnv();
  // happy-dom has no pointer capture; the track rect is top 0, height 200.
  HTMLElement.prototype.setPointerCapture = capture;
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => true;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    height: 200,
  } as DOMRect);
});
afterEach(() => {
  resetCardEnv();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const track = (el: Element, i = 0): HTMLElement => {
  const all = qa(el, '.track');
  if (i >= all.length) throw new Error(`missing track ${String(i)}`);
  return all[i];
};
const readouts = (el: Element) => qa(el, '.readout').map((r) => r.textContent.trim());

async function pointer(el: CurtainControlCard, type: string, y: number, i = 0, pointerId = 1) {
  track(el, i).dispatchEvent(
    new PointerEvent(type, { clientY: y, pointerId, button: 0, bubbles: true }),
  );
  await el.updateComplete;
}

async function key(el: CurtainControlCard, type: 'keydown' | 'keyup', k: string, i = 0) {
  track(el, i).dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
  await el.updateComplete;
}

/** New hass with one cover's state replaced (HA hands the card a fresh object). */
async function update(
  el: CurtainControlCard,
  hass: FakeHass,
  id: string,
  pos: number,
  state = 'open',
) {
  const next: FakeHass = {
    ...hass,
    states: { ...hass.states, [id]: { ...full(pos), entity_id: id, state } },
  };
  el.hass = next;
  await el.updateComplete;
  return next;
}

const SET = (id: string, position: number) => [
  'cover',
  'set_cover_position',
  { entity_id: id, position },
];

describe('tap and drag (spec §4)', () => {
  it('down sets at once, move updates live, up sends exactly one command', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 100);
    expect(capture).toHaveBeenCalledWith(1);
    expect(readouts(el)).toEqual(['50%']);
    expect(track(el).getAttribute('aria-valuenow')).toBe('50');
    await pointer(el, 'pointermove', 40);
    expect(readouts(el)).toEqual(['80%']);
    expect(hass.calls).toEqual([]);
    await pointer(el, 'pointerup', 40);
    expect(hass.calls).toEqual([SET('cover.a', 80)]);
  });

  it('release at the current position still resends it (owner, 2026-11-16)', async () => {
    // HA 2024.8 demo covers step toward a target without reporting opening, so the card cannot
    // tell a resting cover from a moving one: always send.
    const hass = fakeHass({ 'cover.a': full(50) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 100);
    await pointer(el, 'pointerup', 100);
    expect(hass.calls).toEqual([SET('cover.a', 50)]);
  });

  it('pointercancel reverts to the entity value, no command', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 100);
    await pointer(el, 'pointercancel', 100);
    expect(readouts(el)).toEqual(['20%']);
    await pointer(el, 'pointerup', 100);
    expect(hass.calls).toEqual([]);
  });

  it('shows the drag ring and hides the moving indicator while dragging', async () => {
    const hass = fakeHass({ 'cover.a': { ...full(20), state: 'opening' } });
    const el = await mount({ entities: ['cover.a'] }, hass);
    expect(q(el, 'svg.moving')).not.toBeNull();
    await pointer(el, 'pointerdown', 100);
    expect(one(el, '.column').classList.contains('dragging')).toBe(true);
    expect(q(el, 'svg.moving')).toBeNull();
    await pointer(el, 'pointerup', 100);
    expect(one(el, '.column').classList.contains('dragging')).toBe(false);
  });

  it('Review Focus 1: a hass update mid-drag does not move the readout', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 100);
    await update(el, hass, 'cover.a', 10);
    expect(readouts(el)).toEqual(['50%']);
  });

  it('Review Focus 4: the same entity twice — dragging column 0 leaves column 1', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a', 'cover.a'] }, hass);
    await pointer(el, 'pointerdown', 100, 0);
    expect(readouts(el)).toEqual(['50%', '20%']);
  });

  it('Review Focus 5: setConfig mid-drag cancels it; release sends nothing', async () => {
    const hass = fakeHass({ 'cover.a': full(20), 'cover.b': full(40) });
    const el = await mount({ entities: ['cover.a', 'cover.b'] }, hass);
    await pointer(el, 'pointerdown', 100, 1);
    el.setConfig({ type: 'x', entities: ['cover.a'] });
    await el.updateComplete;
    expect(() => {
      track(el).dispatchEvent(new PointerEvent('pointerup', { clientY: 0, pointerId: 1 }));
    }).not.toThrow();
    expect(hass.calls).toEqual([]);
    expect(readouts(el)).toEqual(['20%']);
  });

  it('a second finger does not hijack an active drag', async () => {
    const hass = fakeHass({ 'cover.a': full(20), 'cover.b': full(40) });
    const el = await mount({ entities: ['cover.a', 'cover.b'] }, hass);
    await pointer(el, 'pointerdown', 100, 0, 1);
    await pointer(el, 'pointerdown', 0, 1, 2);
    expect(readouts(el)).toEqual(['50%', '40%']);
  });
});

describe('pending target (spec §4)', () => {
  it('shows the target while the cover catches up, then the entity again', async () => {
    let hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 40);
    await pointer(el, 'pointerup', 40);
    hass = await update(el, hass, 'cover.a', 30, 'opening');
    expect(readouts(el)).toEqual(['80%']);
    await update(el, hass, 'cover.a', 79, 'opening');
    expect(readouts(el)).toEqual(['79%']);
  });

  it('expires after the hold time even with no further hass update', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 40);
    await pointer(el, 'pointerup', 40);
    expect(readouts(el)).toEqual(['80%']);
    vi.advanceTimersByTime(PENDING_HOLD_MS + 100);
    await el.updateComplete;
    expect(readouts(el)).toEqual(['20%']);
  });

  it('a failed command drops the pending target', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    hass.callService = () => Promise.reject(new Error('offline'));
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 40);
    await pointer(el, 'pointerup', 40);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(readouts(el)).toEqual(['20%']);
  });

  it('a late failure of an older command keeps the newer target', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const rejects: ((e: Error) => void)[] = [];
    hass.callService = () =>
      new Promise((_, reject) => {
        rejects.push(reject);
      });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 120); // 40
    await pointer(el, 'pointerup', 120);
    await pointer(el, 'pointerdown', 60); // 70
    await pointer(el, 'pointerup', 60);
    rejects[0]?.(new Error('offline'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(readouts(el)).toEqual(['70%']);
  });

  it('a config edit that keeps the entities keeps the pending target', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 40);
    await pointer(el, 'pointerup', 40);
    el.setConfig({ type: 'x', entities: ['cover.a'], theme: 'dark' });
    await el.updateComplete;
    expect(readouts(el)).toEqual(['80%']);
    el.setConfig({ type: 'x', entities: ['cover.a', 'cover.a'] });
    await el.updateComplete;
    expect(readouts(el)).toEqual(['20%', '20%']);
  });

  it('a button press clears the pending target', async () => {
    const hass = fakeHass({ 'cover.a': full(20) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await pointer(el, 'pointerdown', 40);
    await pointer(el, 'pointerup', 40);
    one(el, 'button.stop').click();
    await el.updateComplete;
    expect(readouts(el)).toEqual(['20%']);
  });
});

describe('keyboard (spec §4)', () => {
  it('arrow keys step by 5, one command on keyup; Home is 100', async () => {
    const hass = fakeHass({ 'cover.a': full(50), 'cover.b': full(50) });
    const el = await mount({ entities: ['cover.a', 'cover.b'] }, hass);
    expect(track(el).tabIndex).toBe(0);
    await key(el, 'keydown', 'ArrowUp');
    await key(el, 'keydown', 'ArrowUp'); // auto-repeat
    expect(readouts(el)[0]).toBe('60%');
    expect(hass.calls).toEqual([]);
    await key(el, 'keyup', 'ArrowUp');
    expect(hass.calls).toEqual([SET('cover.a', 60)]);
    await key(el, 'keydown', 'Home', 1);
    await key(el, 'keyup', 'Home', 1);
    expect(hass.calls[hass.calls.length - 1]).toEqual(SET('cover.b', 100));
  });

  it('one command only after the last held slider key is released', async () => {
    const hass = fakeHass({ 'cover.a': full(50) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await key(el, 'keydown', 'ArrowUp');
    await key(el, 'keydown', 'ArrowDown');
    await key(el, 'keyup', 'ArrowDown');
    expect(hass.calls).toEqual([]);
    await key(el, 'keydown', 'ArrowUp');
    await key(el, 'keyup', 'ArrowUp');
    expect(hass.calls).toEqual([SET('cover.a', 55)]);
  });

  it('focus leaving mid-hold reverts and sends nothing', async () => {
    const hass = fakeHass({ 'cover.a': full(50) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    await key(el, 'keydown', 'ArrowUp');
    track(el).dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(readouts(el)).toEqual(['50%']);
    await key(el, 'keyup', 'ArrowUp');
    expect(hass.calls).toEqual([]);
  });

  it('keys and pointer never drive one column at the same time', async () => {
    const hass = fakeHass({ 'cover.a': full(20), 'cover.b': full(50) });
    const el = await mount({ entities: ['cover.a', 'cover.b'] }, hass);
    await pointer(el, 'pointerdown', 100);
    await key(el, 'keydown', 'ArrowUp');
    await key(el, 'keyup', 'ArrowUp');
    await pointer(el, 'pointerup', 100);
    expect(hass.calls).toEqual([SET('cover.a', 50)]);
    await key(el, 'keydown', 'ArrowUp', 1);
    await pointer(el, 'pointerdown', 0, 1);
    await pointer(el, 'pointerup', 0, 1);
    await key(el, 'keyup', 'ArrowUp', 1);
    expect(hass.calls).toEqual([SET('cover.a', 50), SET('cover.b', 55)]);
  });

  it('other keys are left to the page', async () => {
    const hass = fakeHass({ 'cover.a': full(50) });
    const el = await mount({ entities: ['cover.a'] }, hass);
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    track(el).dispatchEvent(ev);
    await key(el, 'keyup', 'Tab');
    expect(ev.defaultPrevented).toBe(false);
    expect(hass.calls).toEqual([]);
  });
});

describe('read-only and unavailable tracks', () => {
  it('ignore pointer and keys, and are not focusable', async () => {
    const hass = fakeHass({
      'cover.r': { state: 'open', attributes: { supported_features: 3 } },
      'cover.u': { state: 'unavailable', attributes: {} },
    });
    const el = await mount({ entities: ['cover.r', 'cover.u'] }, hass);
    for (const i of [0, 1]) {
      await pointer(el, 'pointerdown', 100, i);
      await pointer(el, 'pointerup', 100, i);
      await key(el, 'keydown', 'ArrowUp', i);
      await key(el, 'keyup', 'ArrowUp', i);
      expect(track(el, i).hasAttribute('tabindex')).toBe(false);
    }
    expect(hass.calls).toEqual([]);
    expect(readouts(el)).toEqual(['Open', '—']);
    expect(track(el, 0).getAttribute('aria-readonly')).toBe('true');
    expect(track(el, 1).getAttribute('aria-disabled')).toBe('true');
  });

  it('only draggable tracks block page scroll (touch-action)', () => {
    expect(cardStyles.cssText).toMatch(/\.normal \.track\s*\{[^}]*touch-action:\s*none/);
  });
});
