import type { HomeAssistant } from './types';

export type ButtonAction = 'open' | 'close' | 'stop';
export type CoverAction = ButtonAction | 'set';

const SERVICE: Record<CoverAction, string> = {
  open: 'open_cover',
  close: 'close_cover',
  stop: 'stop_cover',
  set: 'set_cover_position',
};

/** The only place the card calls Home Assistant services (spec §6). */
export function callCover(
  hass: HomeAssistant,
  action: ButtonAction,
  entityId: string,
): Promise<unknown>;
/** `position` is a core value already clamped to 0–100 (`clampPercent` / `pointerToPercent`). */
export function callCover(
  hass: HomeAssistant,
  action: 'set',
  entityId: string,
  position: number,
): Promise<unknown>;
export function callCover(
  hass: HomeAssistant,
  action: CoverAction,
  entityId: string,
  position?: number,
): Promise<unknown> {
  const data: Record<string, unknown> = { entity_id: entityId };
  if (action === 'set') data.position = position;
  return hass.callService('cover', SERVICE[action], data);
}
