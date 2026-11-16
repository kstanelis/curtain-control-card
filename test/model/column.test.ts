import { describe, expect, it } from 'vitest';
import { columnView, fabricChipEdge } from '../../src/model/column';
import { makeCurtain, type CurtainInput } from '../../src/model/curtain';

const all = { open: true, stop: true, close: true, setPosition: true };
const curtain = (over: Partial<CurtainInput> = {}) =>
  makeCurtain({
    key: '0:cover.a',
    entityId: 'cover.a',
    name: 'A',
    state: 'open',
    position: 65,
    stateLabel: 'Open',
    features: all,
    ...over,
  });

describe('columnView — state table (spec §5)', () => {
  it('open with position: normal, fill = position, NN% readout, all controls', () => {
    expect(columnView(curtain(), null)).toEqual({
      key: '0:cover.a',
      entityId: 'cover.a',
      name: 'A',
      status: 'normal',
      fill: 65,
      readout: '65%',
      interactive: true,
      disabled: false,
      buttons: { open: true, stop: true, close: true },
      moving: null,
    });
  });

  it('opening → moving up, closing → moving down', () => {
    expect(columnView(curtain({ state: 'opening' }), null).moving).toBe('up');
    expect(columnView(curtain({ state: 'closing' }), null).moving).toBe('down');
  });

  it('clamps and rounds the override', () => {
    expect(columnView(curtain(), -5).readout).toBe('0%');
    expect(columnView(curtain(), 33.3333).readout).toBe('33%');
  });

  it('display override (drag / pending target) wins over position', () => {
    const v = columnView(curtain(), 30);
    expect(v.fill).toBe(30);
    expect(v.readout).toBe('30%');
  });
});

describe('columnView — no position support (spec §3, Edge 2)', () => {
  const noSet = { open: true, stop: false, close: true, setPosition: false };

  it('without SET_POSITION: read-only, full when open, state label, buttons per bits', () => {
    const v = columnView(curtain({ features: noSet }), null);
    expect(v.status).toBe('readonly');
    expect(v.fill).toBe(100);
    expect(v.readout).toBe('Open');
    expect(v.interactive).toBe(false);
    expect(v.disabled).toBe(false);
    expect(v.buttons).toEqual({ open: true, stop: false, close: true });
  });

  it('opening counts as open, closed/closing as empty', () => {
    expect(columnView(curtain({ features: noSet, state: 'opening' }), null).fill).toBe(100);
    expect(columnView(curtain({ features: noSet, state: 'closed' }), null).fill).toBe(0);
    expect(columnView(curtain({ features: noSet, state: 'closing' }), null).fill).toBe(0);
  });

  it('missing current_position with SET_POSITION is read-only too', () => {
    const v = columnView(curtain({ position: undefined }), null);
    expect(v.status).toBe('readonly');
    expect(v.interactive).toBe(false);
  });

  it('ignores a display override when read-only', () => {
    expect(columnView(curtain({ features: noSet }), 30).fill).toBe(100);
  });
});

describe('columnView — unavailable / unknown / missing (spec §3, Edge 1)', () => {
  it.each(['unavailable', 'unknown'])('%s: dash, empty, controls shown but disabled', (state) => {
    const v = columnView(curtain({ state }), 40);
    expect(v.status).toBe('unavailable');
    expect(v.readout).toBe('—');
    expect(v.fill).toBe(0);
    expect(v.interactive).toBe(false);
    expect(v.disabled).toBe(true);
    expect(v.buttons).toEqual({ open: true, stop: true, close: true });
    expect(v.moving).toBeNull();
  });
});

describe('fabricChipEdge (owner 2026-11-16: chip never covers the handle)', () => {
  it.each([
    [0, true, 'top'],
    [49, true, 'top'],
    [50, true, 'bottom'],
    [100, true, 'bottom'],
    [0, false, 'bottom'],
  ] as const)('fill %i, interactive %s → %s', (fill, interactive, edge) => {
    expect(fabricChipEdge({ fill, interactive })).toBe(edge);
  });
});
