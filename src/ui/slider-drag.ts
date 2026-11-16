import { pointerToPercent } from '../model/position';

interface Active {
  key: string;
  pointerId: number;
  track: HTMLElement;
  v: number;
}

/**
 * Pointer gesture on one slider track: pointerdown sets the value at once
 * and captures the pointer, pointermove updates live, pointerup commits once, cancel reverts.
 * No Home Assistant knowledge: the card decides what a commit does.
 */
export class SliderDrag {
  private active: Active | null = null;

  constructor(
    private readonly onChange: (key: string, v: number | null) => void,
    private readonly onCommit: (key: string, v: number) => void,
  ) {}

  down(key: string, ev: PointerEvent, track: HTMLElement): void {
    if (this.active || ev.button !== 0) return;
    try {
      track.setPointerCapture(ev.pointerId);
    } catch {
      // Pointer already gone (e.g. a late webview event): drag on without capture.
    }
    this.active = { key, pointerId: ev.pointerId, track, v: this.at(ev, track) };
    this.onChange(key, this.active.v);
  }

  move(ev: PointerEvent): void {
    const a = this.mine(ev);
    if (!a) return;
    const v = this.at(ev, a.track);
    if (v === a.v) return;
    a.v = v;
    this.onChange(a.key, v);
  }

  up(ev: PointerEvent): void {
    const a = this.mine(ev);
    if (!a) return;
    this.active = null;
    this.onCommit(a.key, a.v);
  }

  /** Revert the live value; nothing is sent. */
  cancel(): void {
    const a = this.active;
    if (!a) return;
    this.active = null;
    if (a.track.hasPointerCapture(a.pointerId)) a.track.releasePointerCapture(a.pointerId);
    this.onChange(a.key, null);
  }

  /** Live value while this column is being dragged, else null. */
  value(key: string): number | null {
    return this.active?.key === key ? this.active.v : null;
  }

  private mine(ev: PointerEvent): Active | null {
    return this.active?.pointerId === ev.pointerId ? this.active : null;
  }

  private at(ev: PointerEvent, track: HTMLElement): number {
    return pointerToPercent(ev.clientY, track.getBoundingClientRect());
  }
}
