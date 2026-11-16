import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRID_OPTIONS, LAYOUT_OPTIONS } from '../../src/model/sizing';
import { full, installCardEnv, mount, one, q, qa, resetCardEnv, size } from '../helpers/card';
import { fakeHass, type FakeHass } from '../helpers/hass';

beforeEach(installCardEnv);
afterEach(resetCardEnv);

const four = fakeHass({
  'cover.a': full(10),
  'cover.b': full(20),
  'cover.c': full(30),
  'cover.d': full(40),
});
const ids4 = ['cover.a', 'cover.b', 'cover.c', 'cover.d'];

describe('registration', () => {
  it('defines the element and a customCards entry with getEntitySuggestion', () => {
    expect(customElements.get('curtain-control-card')).toBeDefined();
    const entry = window.customCards?.find((c) => c.type === 'curtain-control-card');
    expect(entry).toMatchObject({ name: 'Curtain Control Card', preview: true });
    expect(typeof entry?.getEntitySuggestion).toBe('function');
  });

  it('getStubConfig delegates to the adapter', () => {
    const Card = customElements.get('curtain-control-card') as unknown as {
      getStubConfig(h: FakeHass): unknown;
    };
    expect(Card.getStubConfig(fakeHass({ 'cover.a': {} }))).toEqual({
      entities: ['cover.a'],
      style: 'pill',
    });
  });
});

describe('render', () => {
  it('one column per entity, laid out by computeLayout', async () => {
    const el = await mount({ entities: ids4 }, four);
    expect(qa(el, '.column')).toHaveLength(4);
    expect(one(el, '.grid').style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
  });

  it('8 entities at 440 px wrap into 2 rows', async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `cover.e${String(i)}`);
    const el = await mount(
      { entities: ids },
      fakeHass(Object.fromEntries(ids.map((id) => [id, full(50)]))),
    );
    expect(one(el, '.grid').style.gridTemplateRows).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('style class and theme tokens on ha-card', async () => {
    const el = await mount({ entities: ids4, style: 'fabric', theme: 'dark' }, four);
    const card = one(el, 'ha-card');
    expect(card.classList.contains('fabric')).toBe(true);
    expect(card.style.getPropertyValue('--cc-card')).toBe('#1c1c1c');
    expect(card.style.getPropertyValue('--cc-fabric-a')).toBe('#d8c7a8');
  });

  it('readouts follow the column view', async () => {
    const hass = fakeHass({
      'cover.a': full(65),
      'cover.r': { state: 'open', attributes: { supported_features: 3 } },
      'cover.u': { state: 'unavailable', attributes: {} },
    });
    const el = await mount({ entities: ['cover.a', 'cover.r', 'cover.u'] }, hass);
    expect(qa(el, '.readout').map((r) => r.textContent.trim())).toEqual(['65%', 'Open', '—']);
    const track = one(el, '.column .track');
    expect(track.getAttribute('role')).toBe('slider');
    expect(track.getAttribute('aria-valuenow')).toBe('65');
  });

  it('only interactive pill fills reserve room for the handle bar (seen on real HA)', async () => {
    const hass = fakeHass({
      'cover.a': full(0),
      'cover.r': { state: 'closed', attributes: { supported_features: 3 } },
    });
    const el = await mount({ entities: ['cover.a', 'cover.r'] }, hass);
    expect(qa(el, '.fill').map((f) => f.className)).toEqual(['fill handle', 'fill']);
  });

  it('fabric chip sits on the side away from the handle', async () => {
    const hass = fakeHass({ 'cover.a': full(10), 'cover.b': full(80) });
    const el = await mount({ entities: ['cover.a', 'cover.b'], style: 'fabric' }, hass);
    expect(qa(el, '.chip-row').map((r) => r.className)).toEqual([
      'chip-row top',
      'chip-row bottom',
    ]);
  });

  it('moving indicator only while opening/closing', async () => {
    const hass = fakeHass({ 'cover.a': { ...full(50), state: 'opening' }, 'cover.b': full(50) });
    const el = await mount({ entities: ['cover.a', 'cover.b'] }, hass);
    expect(qa(el, 'svg.moving').map((s) => s.getAttribute('data-motion'))).toEqual(['up']);
  });

  it('Masonry uses the configured height; Sections fills the cell', async () => {
    const m = await mount({ entities: ids4, height: '400px' }, four);
    expect(one(m, 'ha-card').style.height).toBe('400px');
    const g = await mount({ entities: ids4, height: '400px' }, four, 'grid');
    expect(one(g, 'ha-card').style.height).toBe('100%');
  });
});

describe('buttons and more-info (spec §6)', () => {
  it.each([
    ['.open', 'open_cover'],
    ['.stop', 'stop_cover'],
    ['.close', 'close_cover'],
  ])('%s calls cover.%s for its column', async (sel, service) => {
    const hass = fakeHass({ 'cover.a': full(10), 'cover.b': full(20) });
    const el = await mount({ entities: ['cover.a', 'cover.b'] }, hass);
    (qa(el, `button${sel}`)[1] as HTMLButtonElement).click();
    expect(hass.calls).toEqual([['cover', service, { entity_id: 'cover.b' }]]);
  });

  it('missing feature bits remove buttons; unavailable disables them', async () => {
    const hass = fakeHass({
      'cover.r': { state: 'open', attributes: { supported_features: 3 } },
      'cover.u': { state: 'unavailable', attributes: {} },
    });
    const el = await mount({ entities: ['cover.r', 'cover.u'] }, hass);
    const [r, u] = qa(el, '.column');
    expect(r.querySelector('button.stop')).toBeNull();
    expect(r.querySelector('button.open')).not.toBeNull();
    const unavailable = [
      ...u.querySelectorAll<HTMLButtonElement>('button.open, button.stop, button.close'),
    ];
    expect(unavailable.map((b) => b.disabled)).toEqual([true, true, true]);
  });

  it('a column with no button features has no button group', async () => {
    const hass = fakeHass({
      'cover.t': { state: 'open', attributes: { supported_features: 240 } },
    });
    const el = await mount({ entities: ['cover.t'] }, hass);
    expect(q(el, '.buttons')).toBeNull();
  });

  it('name tap fires hass-more-info (bubbles, composed)', async () => {
    const el = await mount({ entities: ['cover.a'] }, fakeHass({ 'cover.a': full(10) }));
    const seen: unknown[] = [];
    document.body.addEventListener('hass-more-info', (e) => {
      seen.push((e as CustomEvent).detail);
    });
    one(el, 'button.name').click();
    expect(seen).toEqual([{ entityId: 'cover.a' }]);
  });
});

describe('lifecycle', () => {
  it('configured but no hass yet → empty card, not the no-curtains hint', async () => {
    const el = document.createElement('curtain-control-card');
    el.setConfig({ type: 'x', entities: ['cover.a'] });
    document.body.appendChild(el);
    await el.updateComplete;
    expect(q(el, 'ha-card')).not.toBeNull();
    expect(q(el, '.hint')).toBeNull();
    expect(q(el, '.column')).toBeNull();
  });

  it('attached before setConfig → still measures the card', async () => {
    const el = document.createElement('curtain-control-card');
    document.body.appendChild(el);
    await el.updateComplete;
    el.setConfig({ type: 'x', entities: ['cover.a', 'cover.b'] });
    el.hass = fakeHass({ 'cover.a': full(10), 'cover.b': full(20) });
    await el.updateComplete;
    await el.updateComplete;
    expect(one(el, '.grid').style.gridTemplateRows).toBe('repeat(1, minmax(0, 1fr))');
    expect(el.hass).toBeDefined();
  });

  it('layout set after the first render switches to the grid height', async () => {
    const el = await mount({ entities: ids4 }, four);
    el.layout = 'grid';
    await el.updateComplete;
    expect(one(el, 'ha-card').style.height).toBe('100%');
  });

  it('a failed service call does not leave an unhandled rejection', async () => {
    const hass = fakeHass({ 'cover.a': full(10) });
    hass.callService = () => Promise.reject(new Error('device offline'));
    const el = await mount({ entities: ['cover.a'] }, hass);
    one(el, 'button.open').click();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('hass updates', () => {
  it('re-renders for its own entities and for late translations, not for others', async () => {
    const hass = fakeHass({
      'cover.r': { state: 'closed', attributes: { supported_features: 3 } },
      'light.x': {},
    });
    hass.formatEntityState = (s) => s.state; // translations not loaded yet
    const el = await mount({ entities: ['cover.r'] }, hass);
    expect(q(el, '.readout')?.textContent.trim()).toBe('closed');

    const spy = vi.spyOn(el, 'requestUpdate');
    el.hass = {
      ...hass,
      states: { ...hass.states, 'light.x': { entity_id: 'light.x', state: 'off', attributes: {} } },
    };
    expect(spy).not.toHaveBeenCalled();

    el.hass = { ...hass, formatEntityState: () => 'Closed' };
    await el.updateComplete;
    expect(q(el, '.readout')?.textContent.trim()).toBe('Closed');
  });
});

describe('sizing hooks (spec §7)', () => {
  it('getCardSize from px height; grid options are fresh copies', async () => {
    const el = await mount({ entities: ids4 }, four);
    expect(el.getCardSize()).toBe(8);
    expect(el.getGridOptions()).toEqual(GRID_OPTIONS);
    expect(el.getGridOptions()).not.toBe(el.getGridOptions());
    expect(el.getLayoutOptions()).toEqual(LAYOUT_OPTIONS);
  });

  it('non-px height uses the measured height', async () => {
    size.h = 576;
    const el = await mount({ entities: ids4, height: '80vh' }, four);
    expect(el.getCardSize()).toBe(12);
  });
});

describe('config', () => {
  // Owner decision 2026-11-16 (1a): HA sets `preview` only after setConfig, so an empty
  // list never throws; the card shows the no-curtains hint everywhere (spec Edge 6).
  it('no entities shows the hint instead of throwing', async () => {
    const el = document.createElement('curtain-control-card');
    el.setConfig({ type: 'x', entities: [] });
    el.hass = fakeHass({});
    document.body.appendChild(el);
    await el.updateComplete;
    expect(q(el, '.hint')?.textContent).toContain('Pick at least one curtain');
  });

  it('other config errors still throw', () => {
    const el = document.createElement('curtain-control-card');
    expect(() => {
      el.setConfig({ type: 'x', entities: ['light.x'] });
    }).toThrow('Only cover entities are supported');
  });
});
