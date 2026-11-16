import { describe, expect, it } from 'vitest';
import { entitySuggestion, stubConfig } from '../../src/ha/suggest';
import { fakeHass } from '../helpers/hass';

const cover = (device_class?: string) => ({
  state: 'open',
  attributes: device_class ? { device_class } : {},
});

describe('stubConfig (spec §9)', () => {
  it('picks up to 4 covers: curtain, then shade, blind, any', () => {
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

  it('puts unavailable/unknown covers after every working cover', () => {
    const hass = fakeHass({
      'cover.c1': { state: 'unavailable', attributes: { device_class: 'curtain' } },
      'cover.c2': { state: 'unknown', attributes: { device_class: 'curtain' } },
      'cover.n': cover(),
      'cover.s': cover('shade'),
      'cover.c3': cover('curtain'),
    });
    expect(stubConfig(hass).entities).toEqual(['cover.c3', 'cover.s', 'cover.n', 'cover.c1']);
  });

  it('breaks ties by entity id, not hass.states order', () => {
    const hass = fakeHass({ 'cover.z': cover('curtain'), 'cover.m': cover('curtain') });
    expect(stubConfig(hass).entities).toEqual(['cover.m', 'cover.z']);
  });

  it('falls through the classes when there are few curtains', () => {
    const hass = fakeHass({ 'cover.c': cover('garage'), 'cover.b': cover('blind') });
    expect(stubConfig(hass).entities).toEqual(['cover.b', 'cover.c']);
  });

  it('no covers → empty list (editor preview shows the hint)', () => {
    expect(stubConfig(fakeHass({ 'light.x': { state: 'on' } }))).toEqual({
      entities: [],
      style: 'pill',
    });
  });
});

describe('entitySuggestion (HA 2026.6+, spec §9)', () => {
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
