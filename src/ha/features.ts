import type { HassEntity } from './types';

/** HA CoverEntityFeature bits used by the card. */
export const Feature = { OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8 } as const;

export function supports(stateObj: HassEntity, feature: number): boolean {
  const bits = stateObj.attributes.supported_features;
  return typeof bits === 'number' && (bits & feature) !== 0;
}
