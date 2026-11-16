import { describe, expect, it } from 'vitest';
import { isMoving, makeCurtain } from '../../src/model/curtain';

const base = {
  key: '0:cover.a',
  entityId: 'cover.a',
  name: 'A',
  state: 'open',
  position: 65,
  stateLabel: 'Open',
  features: { open: true, stop: true, close: true, setPosition: true },
};

describe('makeCurtain', () => {
  it('keeps known states and a valid position', () => {
    const c = makeCurtain(base);
    expect(c.state).toBe('open');
    expect(c.position).toBe(65);
  });

  it.each(['open', 'closed', 'opening', 'closing'])('accepts state %s', (state) => {
    expect(makeCurtain({ ...base, state }).state).toBe(state);
  });

  it.each(['unavailable', 'unknown', '', 'stopped'])('maps state %j to unavailable', (state) => {
    expect(makeCurtain({ ...base, state }).state).toBe('unavailable');
  });

  it('clamps and rounds the position, null for junk', () => {
    expect(makeCurtain({ ...base, position: '42.6' }).position).toBe(43);
    expect(makeCurtain({ ...base, position: 140 }).position).toBe(100);
    expect(makeCurtain({ ...base, position: undefined }).position).toBeNull();
    expect(makeCurtain({ ...base, position: 'abc' }).position).toBeNull();
  });

  it('is frozen', () => {
    const c = makeCurtain(base);
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.features)).toBe(true);
  });
});

describe('isMoving', () => {
  it('is true only while opening or closing', () => {
    expect(['opening', 'closing', 'open', 'closed', 'unavailable'].map(isMoving)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
