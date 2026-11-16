import { clampPercent } from './position';

export type CurtainState = 'open' | 'closed' | 'opening' | 'closing' | 'unavailable';

export interface CurtainFeatures {
  readonly open: boolean;
  readonly stop: boolean;
  readonly close: boolean;
  readonly setPosition: boolean;
}

/** One configured curtain column, in the card's own terms (no HA types). */
export interface Curtain {
  /** Column key `${index}:${entityId}`; duplicates of one entity stay independent. */
  readonly key: string;
  readonly entityId: string;
  readonly name: string;
  readonly state: CurtainState;
  /** 0–100, or null when the entity reports no usable position. */
  readonly position: number | null;
  /** Localized state text, shown when the position cannot be used. */
  readonly stateLabel: string;
  readonly features: CurtainFeatures;
}

export interface CurtainInput extends Omit<Curtain, 'state' | 'position'> {
  state: string;
  position: unknown;
}

/** Cover is running — the only trigger for the moving indicator and pulse (spec §4). */
export const isMoving = (state: string): boolean => state === 'opening' || state === 'closing';

const KNOWN: readonly string[] = ['open', 'closed', 'opening', 'closing'];

/** False for unavailable, unknown and any other state the card draws as unavailable. */
export const isKnownState = (state: string): boolean => KNOWN.includes(state);

/** Validates raw values: unknown states become unavailable, position is clamped or null. */
export function makeCurtain(input: CurtainInput): Curtain {
  return Object.freeze({
    ...input,
    state: isKnownState(input.state) ? (input.state as CurtainState) : 'unavailable',
    position: clampPercent(input.position),
    features: Object.freeze({ ...input.features }),
  });
}
