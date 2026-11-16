import { describe, expect, it } from 'vitest';
import { Feature, supports } from '../../src/ha/features';

const entity = (supported_features?: unknown) => ({
  entity_id: 'cover.a',
  state: 'open',
  attributes: supported_features === undefined ? {} : { supported_features },
});

describe('cover feature bits', () => {
  it('uses the HA CoverEntityFeature values', () => {
    expect(Feature).toEqual({ OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8 });
  });

  it('reads each bit from supported_features', () => {
    expect(supports(entity(15), Feature.STOP)).toBe(true);
    expect(supports(entity(3), Feature.SET_POSITION)).toBe(false);
    expect(supports(entity(3), Feature.CLOSE)).toBe(true);
  });

  it('treats a missing or non-numeric attribute as no features', () => {
    expect(supports(entity(), Feature.OPEN)).toBe(false);
    expect(supports(entity('15'), Feature.OPEN)).toBe(false);
  });
});
