import { isMoving } from './curtain';

/** Pending target is shown at most this long (spec §4). */
export const PENDING_HOLD_MS = 30_000;
const REACHED_WITHIN = 1;

interface Pending {
  target: number;
  since: number;
  moved: boolean;
}

/**
 * Targets sent to covers, shown until the cover catches up (spec §4 "Pending target"),
 * keyed by column key `${index}:${entityId}` so duplicate entities stay independent.
 */
export class PendingTargets {
  private readonly items = new Map<string, Pending>();

  set(key: string, target: number, now: number): void {
    this.items.set(key, { target, since: now, moved: false });
  }

  /** Drop the key's target; with `target`, only if that is still the target (a newer one stays). */
  clear(key: string, target?: number): void {
    if (target === undefined || this.items.get(key)?.target === target) this.items.delete(key);
  }

  /** Target to display, or null when the entity's own value should be shown. */
  resolve(key: string, current: number | null, state: string, now: number): number | null {
    const p = this.items.get(key);
    if (!p) return null;
    const moving = isMoving(state);
    const reached = current !== null && Math.abs(current - p.target) <= REACHED_WITHIN;
    const stopped = p.moved && !moving;
    if (reached || stopped || now - p.since >= PENDING_HOLD_MS) {
      this.items.delete(key);
      return null;
    }
    if (moving) p.moved = true;
    return p.target;
  }
}
