import { CARD_TYPE, DEFAULTS, isCoverId, type CardStyle } from '../config';
import { isSuggestedClass, pickStubEntities } from '../model/stub';
import type { HassEntity, HomeAssistant } from './types';

/** `getStubConfig(hass)`: ranking lives in the core; this only reads covers from hass. */
export function stubConfig(hass: HomeAssistant): { entities: string[]; style: CardStyle } {
  const candidates = Object.values(hass.states)
    .filter((s): s is HassEntity => s !== undefined && isCoverId(s.entity_id))
    .map((s) => ({
      entityId: s.entity_id,
      state: s.state,
      deviceClass: s.attributes.device_class,
    }));
  return { entities: pickStubEntities(candidates), style: DEFAULTS.style };
}

/** `getEntitySuggestion(hass, id)` (HA 2026.6+): offer the card for curtain/shade/blind covers. */
export function entitySuggestion(
  hass: HomeAssistant,
  entityId: string,
): { config: { type: string; entities: string[] } } | null {
  const s = hass.states[entityId];
  if (!s || !isCoverId(entityId) || !isSuggestedClass(s.attributes.device_class)) return null;
  return { config: { type: `custom:${CARD_TYPE}`, entities: [entityId] } };
}
