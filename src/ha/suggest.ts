import { CARD_TYPE, DEFAULTS, isCoverId, type CardStyle } from '../config';
import type { HassEntity, HomeAssistant } from './types';

const STUB_MAX = 4;
/** Stub preference order; generic device classes only, never names. */
const PREFERRED = ['curtain', 'shade', 'blind'] as const;

const deviceClass = (s: HassEntity): unknown => s.attributes.device_class;
const isDead = (s: HassEntity): boolean => s.state === 'unavailable' || s.state === 'unknown';

/**
 * `getStubConfig(hass)`: up to 4 covers, curtains first, then shades, blinds, any;
 * unavailable/unknown covers after all working ones so the first preview isn't dashed columns.
 */
export function stubConfig(hass: HomeAssistant): { entities: string[]; style: CardStyle } {
  const covers = Object.values(hass.states).filter(
    (s): s is HassEntity => s !== undefined && isCoverId(s.entity_id),
  );
  const classRank = (s: HassEntity): number => {
    const i = PREFERRED.indexOf(deviceClass(s) as (typeof PREFERRED)[number]);
    return i === -1 ? PREFERRED.length : i;
  };
  const rank = (s: HassEntity): number => (isDead(s) ? PREFERRED.length + 1 : 0) + classRank(s);
  // Ties by entity id: hass.states order is websocket arrival order, not stable.
  const entities = covers
    .sort((a, b) => rank(a) - rank(b) || a.entity_id.localeCompare(b.entity_id))
    .slice(0, STUB_MAX)
    .map((s) => s.entity_id);
  return { entities, style: DEFAULTS.style };
}

/** `getEntitySuggestion(hass, id)` (HA 2026.6+): offer the card for curtain/shade/blind covers. */
export function entitySuggestion(
  hass: HomeAssistant,
  entityId: string,
): { config: { type: string; entities: string[] } } | null {
  const s = hass.states[entityId];
  if (!s || !isCoverId(entityId)) return null;
  if (!(PREFERRED as readonly unknown[]).includes(deviceClass(s))) return null;
  return { config: { type: `custom:${CARD_TYPE}`, entities: [entityId] } };
}
