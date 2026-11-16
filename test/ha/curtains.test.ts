import { describe, expect, it } from 'vitest';
import { entityName, toCurtains } from '../../src/ha/curtains';
import { fakeHass } from '../helpers/hass';

const a = { state: 'open', attributes: { current_position: 65, supported_features: 15 } };

describe('toCurtains', () => {
  it('maps a hass entity to a curtain', () => {
    const [c] = toCurtains(fakeHass({ 'cover.a': a }), [{ entity: 'cover.a' }]);
    expect(c).toEqual({
      key: '0:cover.a',
      entityId: 'cover.a',
      name: 'cover.a',
      state: 'open',
      position: 65,
      stateLabel: 'Open',
      features: { open: true, stop: true, close: true, setPosition: true },
    });
  });

  it('reads each feature bit', () => {
    const hass = fakeHass({ 'cover.a': { ...a, attributes: { supported_features: 3 } } });
    expect(toCurtains(hass, [{ entity: 'cover.a' }])[0]?.features).toEqual({
      open: true,
      stop: false,
      close: true,
      setPosition: false,
    });
  });

  it('keys columns by index so duplicate entities stay independent', () => {
    const cs = toCurtains(fakeHass({ 'cover.a': a }), [
      { entity: 'cover.a' },
      { entity: 'cover.a' },
    ]);
    expect(cs.map((c) => c.key)).toEqual(['0:cover.a', '1:cover.a']);
  });

  it('missing entity keeps its slot: unavailable, name = entity id, no features', () => {
    const [c] = toCurtains(fakeHass({}), [{ entity: 'cover.gone' }]);
    expect(c.state).toBe('unavailable');
    expect(c.name).toBe('cover.gone');
    expect(c.position).toBeNull();
    expect(c.features).toEqual({ open: false, stop: false, close: false, setPosition: false });
  });

  describe('name precedence', () => {
    const named = { ...a, attributes: { ...a.attributes, friendly_name: 'Living room' } };

    it('config name wins', () => {
      const hass = fakeHass({ 'cover.a': named }, { formatEntityName: true });
      expect(toCurtains(hass, [{ entity: 'cover.a', name: 'Mine' }])[0]?.name).toBe('Mine');
    });

    it('then formatEntityName when HA has it', () => {
      const hass = fakeHass({ 'cover.a': named }, { formatEntityName: true });
      expect(toCurtains(hass, [{ entity: 'cover.a' }])[0]?.name).toBe('HA cover.a');
    });

    it('then friendly_name', () => {
      expect(toCurtains(fakeHass({ 'cover.a': named }), [{ entity: 'cover.a' }])[0]?.name).toBe(
        'Living room',
      );
    });

    it('then entity id; blank results fall through', () => {
      const hass = fakeHass({ 'cover.a': { ...a, attributes: { friendly_name: ' ' } } });
      hass.formatEntityName = () => '';
      expect(toCurtains(hass, [{ entity: 'cover.a' }])[0]?.name).toBe('cover.a');
    });

    it('entityName gives the HA name without a config name', () => {
      expect(entityName(fakeHass({ 'cover.a': named }), 'cover.a')).toBe('Living room');
      expect(entityName(fakeHass({}), 'cover.x')).toBe('cover.x');
    });
  });
});
