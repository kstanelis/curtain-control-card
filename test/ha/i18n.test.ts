import { describe, expect, it } from 'vitest';
import { localize } from '../../src/ha/i18n';
import { fakeHass } from '../helpers/hass';

describe('localize', () => {
  it('returns English strings', () => {
    expect(localize(fakeHass({}), 'card.open')).toBe('Open');
    expect(localize(fakeHass({}), 'card.unavailable')).toBe('Unavailable');
  });

  it('falls back to English for other languages and missing hass', () => {
    expect(localize(fakeHass({}, { language: 'lt' }), 'card.close')).toBe('Close');
    expect(localize(undefined, 'card.stop')).toBe('Stop');
    expect(localize(fakeHass({}, { language: 'en-GB' }), 'card.open')).toBe('Open');
  });
});
