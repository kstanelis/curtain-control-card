import { describe, expect, it } from 'vitest';
import { relevantChange } from '../../src/ha/changes';
import { fakeHass } from '../helpers/hass';

describe('relevantChange — re-render only when the card would look different', () => {
  const base = fakeHass({ 'cover.a': { state: 'open' }, 'light.x': { state: 'on' } });
  const ids = ['cover.a', 'cover.missing'];

  it('first hass always renders', () => {
    expect(relevantChange(undefined, base, ids)).toBe(true);
  });

  it('same states → no render', () => {
    expect(relevantChange(base, { ...base }, ids)).toBe(false);
  });

  it('a configured entity changed → render', () => {
    const next = {
      ...base,
      states: {
        ...base.states,
        'cover.a': { entity_id: 'cover.a', state: 'open', attributes: {} },
      },
    };
    expect(relevantChange(base, next, ids)).toBe(true);
  });

  it('an unrelated entity changed → no render', () => {
    const next = {
      ...base,
      states: { ...base.states, 'light.x': { entity_id: 'light.x', state: 'off', attributes: {} } },
    };
    expect(relevantChange(base, next, ids)).toBe(false);
  });

  it('a missing entity appears → render', () => {
    const next = {
      ...base,
      states: {
        ...base.states,
        'cover.missing': { entity_id: 'cover.missing', state: 'open', attributes: {} },
      },
    };
    expect(relevantChange(base, next, ids)).toBe(true);
  });

  it('translations or formatters arrive later → render', () => {
    expect(relevantChange(base, { ...base, formatEntityState: () => 'x' }, ids)).toBe(true);
    expect(relevantChange(base, { ...base, localize: () => 'x' }, ids)).toBe(true);
    expect(relevantChange(base, { ...base, formatEntityName: () => 'x' }, ids)).toBe(true);
    expect(relevantChange(base, { ...base, locale: { language: 'lt' } }, ids)).toBe(true);
  });
});
