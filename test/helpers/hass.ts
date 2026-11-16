import type { HassEntity, HomeAssistant } from '../../src/ha/types';

export type FakeHass = HomeAssistant & { calls: unknown[][] };

/** Minimal hass stand-in: states, locale, recorded service calls, optional formatEntityName. */
export function fakeHass(
  states: Record<string, Partial<HassEntity>>,
  opts: { formatEntityName?: boolean; language?: string } = {},
): FakeHass {
  const calls: unknown[][] = [];
  const full: Record<string, HassEntity> = {};
  for (const [id, s] of Object.entries(states)) {
    full[id] = { entity_id: id, state: 'closed', attributes: {}, ...s };
  }
  const hass: FakeHass = {
    states: full,
    locale: { language: opts.language ?? 'en' },
    calls,
    callService: (domain, service, data) => {
      calls.push([domain, service, data]);
      return Promise.resolve();
    },
    formatEntityState: (s) => s.state.charAt(0).toUpperCase() + s.state.slice(1),
  };
  if (opts.formatEntityName) {
    hass.formatEntityName = (s) => `HA ${s.entity_id}`;
  }
  return hass;
}
