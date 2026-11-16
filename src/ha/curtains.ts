import type { EntityConf } from '../config';
import { makeCurtain, type Curtain } from '../model/curtain';
import { Feature, supports } from './features';
import type { HassEntity, HomeAssistant } from './types';

const nonBlank = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

/** Name precedence: config → formatEntityName (HA 2026.4+) → friendly_name → entity id. */
function nameOf(hass: HomeAssistant, conf: EntityConf, stateObj: HassEntity | undefined): string {
  if (conf.name) return conf.name;
  if (!stateObj) return conf.entity;
  const formatted =
    typeof hass.formatEntityName === 'function'
      ? nonBlank(hass.formatEntityName(stateObj, [{ type: 'entity' }]))
      : undefined;
  return formatted ?? nonBlank(stateObj.attributes.friendly_name) ?? conf.entity;
}

/** Anti-corruption layer: configured entities + hass → the card's Curtain model. */
export function toCurtains(hass: HomeAssistant, entities: readonly EntityConf[]): Curtain[] {
  return entities.map((conf, i) => {
    const stateObj = hass.states[conf.entity];
    const has = (f: number) => stateObj !== undefined && supports(stateObj, f);
    return makeCurtain({
      key: `${String(i)}:${conf.entity}`,
      entityId: conf.entity,
      name: nameOf(hass, conf, stateObj),
      state: stateObj?.state ?? 'unavailable',
      position: stateObj?.attributes.current_position,
      stateLabel: stateObj ? hass.formatEntityState(stateObj) : '',
      features: {
        open: has(Feature.OPEN),
        stop: has(Feature.STOP),
        close: has(Feature.CLOSE),
        setPosition: has(Feature.SET_POSITION),
      },
    });
  });
}
