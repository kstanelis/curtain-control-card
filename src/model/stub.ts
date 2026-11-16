import { isKnownState } from './curtain';

/** A cover the stub may pick, in the card's own terms. */
export interface StubCandidate {
  entityId: string;
  state: string;
  deviceClass: unknown;
}

const STUB_MAX = 4;
/** Stub preference order; generic device classes only, never names. */
const STUB_ORDER = ['curtain', 'shade', 'blind'] as const;
/** Device classes the card offers itself for in HA's card picker. */
const SUGGESTED = ['curtain', 'shade', 'blind'] as const;

const classRank = (dc: unknown): number => {
  const i = (STUB_ORDER as readonly unknown[]).indexOf(dc);
  return i === -1 ? STUB_ORDER.length : i;
};

/**
 * Up to 4 covers: curtain, shade, blind, any; covers the card would draw as unavailable after
 * every working one; ties by entity id in code-unit order (locale-independent, deterministic).
 */
export function pickStubEntities(candidates: readonly StubCandidate[]): string[] {
  return candidates
    .map((c) => ({
      id: c.entityId,
      rank: (isKnownState(c.state) ? 0 : STUB_ORDER.length + 1) + classRank(c.deviceClass),
    }))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, STUB_MAX)
    .map((c) => c.id);
}

export function isSuggestedClass(dc: unknown): dc is (typeof SUGGESTED)[number] {
  return (SUGGESTED as readonly unknown[]).includes(dc);
}
