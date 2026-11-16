import type { HomeAssistant } from './types';

/**
 * Whether a new `hass` changes what the card shows: one of its entities changed (HA replaces
 * the state object on change), or translations / formatters / locale changed — HA pushes a new
 * `hass` when translations load after the first render.
 */
export function relevantChange(
  old: HomeAssistant | undefined,
  next: HomeAssistant,
  entityIds: readonly string[],
): boolean {
  if (!old) return true;
  return (
    old.localize !== next.localize ||
    old.formatEntityState !== next.formatEntityState ||
    old.formatEntityName !== next.formatEntityName ||
    old.locale?.language !== next.locale?.language ||
    entityIds.some((id) => old.states[id] !== next.states[id])
  );
}
