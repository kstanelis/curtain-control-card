import { describe, expect, it } from 'vitest';
import { DEFAULTS, MAX_ENTITIES, normalizeConfig } from '../src/config';

const TYPE = 'custom:curtain-control-card';

describe('normalizeConfig', () => {
  it('fills defaults and expands string shorthand', () => {
    expect(normalizeConfig({ type: TYPE, entities: ['cover.a'] })).toEqual({
      type: TYPE,
      entities: [{ entity: 'cover.a' }],
      style: 'pill',
      theme: 'auto',
      height: '360px',
    });
  });

  it('exposes the documented defaults and limit', () => {
    expect(DEFAULTS).toEqual({ style: 'pill', theme: 'auto', height: '360px' });
    expect(MAX_ENTITIES).toBe(8);
  });

  it('keeps a name override and drops blank names', () => {
    const cfg = normalizeConfig({
      type: TYPE,
      entities: [
        { entity: 'cover.a', name: 'Living L' },
        { entity: 'cover.b', name: '' },
        { entity: 'cover.c', name: '  ' },
      ],
    });
    expect(cfg.entities).toEqual([
      { entity: 'cover.a', name: 'Living L' },
      { entity: 'cover.b' },
      { entity: 'cover.c' },
    ]);
  });

  it('turns a numeric height into px and keeps other lengths', () => {
    expect(normalizeConfig({ type: TYPE, entities: ['cover.a'], height: 400 }).height).toBe(
      '400px',
    );
    expect(normalizeConfig({ type: TYPE, entities: ['cover.a'], height: '50vh' }).height).toBe(
      '50vh',
    );
  });

  it('keeps explicit style, theme and accent', () => {
    const cfg = normalizeConfig({
      type: TYPE,
      entities: ['cover.a'],
      style: 'fabric',
      theme: 'dark',
      accent: '#e0a24a',
    });
    expect(cfg.style).toBe('fabric');
    expect(cfg.theme).toBe('dark');
    expect(cfg.accent).toBe('#e0a24a');
  });

  it('passes unknown keys through untouched', () => {
    expect(normalizeConfig({ type: TYPE, entities: ['cover.a'], foo: 1 }).foo).toBe(1);
  });

  it('allows the same entity twice', () => {
    expect(normalizeConfig({ type: TYPE, entities: ['cover.a', 'cover.a'] }).entities).toHaveLength(
      2,
    );
  });

  it('does not mutate the input', () => {
    const raw = { type: TYPE, entities: ['cover.a'] };
    normalizeConfig(raw);
    expect(raw).toEqual({ type: TYPE, entities: ['cover.a'] });
  });

  it.each([
    [{ type: TYPE }, 'Add at least one cover entity'],
    [{ type: TYPE, entities: [] }, 'Add at least one cover entity'],
    [
      { type: TYPE, entities: Array.from({ length: 9 }, (_, i) => `cover.c${String(i)}`) },
      'At most 8 entities are supported',
    ],
    [{ type: TYPE, entities: ['light.x'] }, 'Only cover entities are supported: light.x'],
    [{ type: TYPE, entities: [{ name: 'x' }] }, 'Each entity needs an entity id'],
    [{ type: TYPE, entities: [42] }, 'Each entity needs an entity id'],
    [{ type: TYPE, entities: ['cover.a'], style: 'x' }, 'style must be pill or fabric'],
    [{ type: TYPE, entities: ['cover.a'], theme: 'x' }, 'theme must be auto, light or dark'],
    [null, 'Invalid configuration'],
    ['cover.a', 'Invalid configuration'],
  ])('rejects %j', (raw, message) => {
    expect(() => normalizeConfig(raw)).toThrow(message);
  });

  it('allows an empty entity list only when asked (editor preview)', () => {
    expect(normalizeConfig({ type: TYPE, entities: [] }, { allowEmpty: true }).entities).toEqual(
      [],
    );
    expect(normalizeConfig({ type: TYPE }, { allowEmpty: true }).entities).toEqual([]);
  });
});
