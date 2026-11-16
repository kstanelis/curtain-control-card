const KEY_STEP = 5;

const clamp = (v: number): number => Math.min(100, Math.max(0, v));

/** Pointer y on the track → % open (top = 100 = fully open). */
export function pointerToPercent(clientY: number, rect: { top: number; height: number }): number {
  if (rect.height <= 0) return 0;
  return clamp(Math.round(100 - ((clientY - rect.top) / rect.height) * 100));
}

/** Any position-like value → rounded 0–100, or null when it is not a number. */
export function clampPercent(v: unknown): number | null {
  if (typeof v === 'string' && v.trim() === '') return null;
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(v);
  return Number.isFinite(n) ? clamp(Math.round(n)) : null;
}

/** Keyboard step on the slider; null for keys the slider ignores. */
export function keyStep(key: string, v: number): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return clamp(v + KEY_STEP);
    case 'ArrowDown':
    case 'ArrowLeft':
      return clamp(v - KEY_STEP);
    case 'Home':
      return 100;
    case 'End':
      return 0;
    default:
      return null;
  }
}
