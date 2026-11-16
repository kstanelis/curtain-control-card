import { describe, expect, it } from 'vitest';
import { entitySuggestion, stubConfig } from '../../src/ha/suggest';
import { fakeHass } from '../helpers/hass';

const cover = (device_class?: string) => ({
  state: 'open',
  attributes: device_class ? { device_class } : {},
});

describe('stubConfig — wiring (ranking is tested in test/model/stub.test.ts)', () => {
  it('feeds only covers from hass.states to the core ranking', () => {
    const hass = fakeHass({
      'cover.a': cover('curtain'),
      'cover.b': cover('blind'),
      'cover.c': cover(),
      'cover.d': cover('shade'),
      'light.x': { state: 'on', attributes: { device_class: 'curtain' } },
      'cover.e': cover('curtain'),
      'cover.f': cover('curtain'),
    });
    expect(stubConfig(hass)).toEqual({
      entities: ['cover.a', 'cover.e', 'cover.f', 'cover.d'],
      style: 'pill',
    });
  });

  it('passes state through, so dead covers rank last', () => {
    const hass = fakeHass({
      'cover.a': { state: 'unavailable', attributes: { device_class: 'curtain' } },
      'cover.b': cover(),
    });
    expect(stubConfig(hass).entities).toEqual(['cover.b', 'cover.a']);
  });

  it('reads device_class from attributes and skips empty state slots', () => {
    const hass = fakeHass({
      'cover.n': { state: 'open', attributes: {} },
      'cover.s': { state: 'open', attributes: { device_class: 'shade' } },
    });
    hass.states['cover.gone'] = undefined;
    expect(stubConfig(hass).entities).toEqual(['cover.s', 'cover.n']);
  });

  it('no covers → empty list (editor preview shows the hint)', () => {
    expect(stubConfig(fakeHass({ 'light.x': { state: 'on' } }))).toEqual({
      entities: [],
      style: 'pill',
    });
  });
});

describe('entitySuggestion (HA 2026.6+)', () => {
  const hass = fakeHass({
    'cover.a': cover('curtain'),
    'cover.s': cover('shade'),
    'cover.b': cover('blind'),
    'cover.g': cover('garage'),
    'cover.n': cover(),
    'light.x': { state: 'on', attributes: { device_class: 'curtain' } },
  });

  it.each(['cover.a', 'cover.s', 'cover.b'])('suggests the card for %s', (id) => {
    expect(entitySuggestion(hass, id)).toEqual({
      config: { type: 'custom:curtain-control-card', entities: [id] },
    });
  });

  it.each(['cover.g', 'cover.n', 'light.x', 'cover.missing'])('no suggestion for %s', (id) => {
    expect(entitySuggestion(hass, id)).toBeNull();
  });
});
