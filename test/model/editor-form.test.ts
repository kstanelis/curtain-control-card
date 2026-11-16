import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../../src/config';
import { formCanShow, fromForm, toForm } from '../../src/model/editor-form';

const TYPE = 'custom:curtain-control-card';
const cfg = (raw: Record<string, unknown>) => normalizeConfig({ type: TYPE, ...raw });

describe('toForm', () => {
  it('shows defaults for style and theme; height stays empty so its placeholder shows', () => {
    expect(toForm(cfg({ entities: ['cover.a'] }))).toEqual({
      entity_ids: ['cover.a'],
      style: 'pill',
      theme: 'auto',
    });
  });

  it('carries names, non-default height and accent', () => {
    const form = toForm(
      cfg({
        entities: [{ entity: 'cover.a', name: 'Living L' }, 'cover.b'],
        style: 'fabric',
        theme: 'dark',
        height: '50vh',
        accent: '#e0a24a',
      }),
    );
    expect(form).toEqual({
      entity_ids: ['cover.a', 'cover.b'],
      'name:cover.a': 'Living L',
      style: 'fabric',
      theme: 'dark',
      height: '50vh',
      accent: '#e0a24a',
    });
  });
});

describe('formCanShow', () => {
  it('the same entity twice is fine while both copies share a name', () => {
    expect(formCanShow(cfg({ entities: ['cover.a', 'cover.a', 'cover.b'] }))).toBe(true);
    expect(
      formCanShow(
        cfg({
          entities: [
            { entity: 'cover.a', name: 'X' },
            { entity: 'cover.a', name: 'X' },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('two names for one entity cannot be shown', () => {
    const two = (b: unknown) => cfg({ entities: [{ entity: 'cover.a', name: 'One' }, b] });
    expect(formCanShow(two({ entity: 'cover.a', name: 'Two' }))).toBe(false);
    expect(formCanShow(two('cover.a'))).toBe(false);
  });
});

describe('fromForm', () => {
  const prev = cfg({ entities: ['cover.a'], foo: 1 });

  it('never writes defaults or empty values; keeps type and unknown keys', () => {
    const out = fromForm(prev, {
      entity_ids: ['cover.a', 'cover.b'],
      'name:cover.a': '  ',
      style: 'pill',
      theme: 'auto',
      height: '360px',
      accent: '',
    });
    expect(out).toEqual({ type: TYPE, entities: ['cover.a', 'cover.b'], foo: 1 });
  });

  it('writes non-default values, trimmed', () => {
    const out = fromForm(prev, {
      entity_ids: ['cover.a'],
      'name:cover.a': ' Living L ',
      style: 'fabric',
      theme: 'light',
      height: ' 400px ',
      accent: ' red ',
    });
    expect(out).toEqual({
      type: TYPE,
      entities: [{ entity: 'cover.a', name: 'Living L' }],
      foo: 1,
      style: 'fabric',
      theme: 'light',
      height: '400px',
      accent: 'red',
    });
  });

  it('caps the list at 8', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `cover.c${String(i)}`);
    expect(fromForm(prev, { entity_ids: ids }).entities).toHaveLength(8);
  });

  it('names follow their entity across a reorder; removing an entity drops its name', () => {
    const named = cfg({ entities: [{ entity: 'cover.a', name: 'A' }, 'cover.b'] });
    const form = toForm(named);
    expect(fromForm(named, { ...form, entity_ids: ['cover.b', 'cover.a'] }).entities).toEqual([
      'cover.b',
      { entity: 'cover.a', name: 'A' },
    ]);
    expect(fromForm(named, { ...form, entity_ids: ['cover.b'] }).entities).toEqual(['cover.b']);
  });

  it('a missing or malformed entity list becomes empty; non-string ids are dropped', () => {
    expect(fromForm(prev, {}).entities).toEqual([]);
    expect(fromForm(prev, { entity_ids: 'cover.a' }).entities).toEqual([]);
    expect(fromForm(prev, { entity_ids: ['cover.a', 7, ''] }).entities).toEqual(['cover.a']);
  });

  it('drops a previously set non-default when the form returns it to default', () => {
    const styled = cfg({ entities: ['cover.a'], style: 'fabric', height: '50vh' });
    const out = fromForm(styled, { entity_ids: ['cover.a'], style: 'pill' });
    expect('style' in out).toBe(false);
    expect('height' in out).toBe(false);
  });
});
