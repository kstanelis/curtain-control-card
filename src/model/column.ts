import type { Curtain } from './curtain';
import { clampPercent } from './position';

export type ColumnStatus = 'normal' | 'readonly' | 'unavailable';

/** What one column renders. */
export interface ColumnView {
  key: string;
  entityId: string;
  name: string;
  status: ColumnStatus;
  /** Track fill, 0–100. */
  fill: number;
  readout: string;
  /** Track accepts tap / drag / keys. */
  interactive: boolean;
  /** Buttons shown but disabled (unavailable). */
  disabled: boolean;
  /** Which buttons exist, per feature bits. */
  buttons: { open: boolean; stop: boolean; close: boolean };
  moving: 'up' | 'down' | null;
}

const UNAVAILABLE_READOUT = '—';

/** `override` is the live drag value or pending target; ignored unless the track is usable. */
export function columnView(c: Curtain, override: number | null): ColumnView {
  const head = { key: c.key, entityId: c.entityId, name: c.name };

  if (c.state === 'unavailable') {
    return {
      ...head,
      status: 'unavailable',
      fill: 0,
      readout: UNAVAILABLE_READOUT,
      interactive: false,
      disabled: true,
      buttons: { open: true, stop: true, close: true },
      moving: null,
    };
  }

  const buttons = { open: c.features.open, stop: c.features.stop, close: c.features.close };
  const moving = c.state === 'opening' ? 'up' : c.state === 'closing' ? 'down' : null;
  const common = { ...head, disabled: false, buttons, moving } as const;

  if (!c.features.setPosition || c.position === null) {
    const isOpen = c.state === 'open' || c.state === 'opening';
    return {
      ...common,
      status: 'readonly',
      fill: isOpen ? 100 : 0,
      readout: c.stateLabel,
      interactive: false,
    };
  }

  const fill = clampPercent(override) ?? c.position;
  return { ...common, status: 'normal', fill, readout: `${String(fill)}%`, interactive: true };
}

/**
 * Fabric readout chip edge: on the side away from the fabric handle, so they never overlap.
 * Handle sits at (100 − fill)% from the top; read-only columns have no handle.
 */
export function fabricChipEdge(v: Pick<ColumnView, 'fill' | 'interactive'>): 'top' | 'bottom' {
  return v.interactive && v.fill < 50 ? 'top' : 'bottom';
}
