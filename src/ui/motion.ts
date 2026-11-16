export const PULSE_KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }];
export const PULSE_TIMING: KeyframeAnimationOptions = {
  duration: 1200,
  iterations: Infinity,
  easing: 'ease-in-out',
};

const pulses = new WeakMap<Element, Animation>();

/** Start or stop the moving-indicator pulse on `el`; at most one Animation per element. */
export function syncPulse(el: Element, running: boolean, reduced: boolean): void {
  const current = pulses.get(el);
  const on = running && !reduced;
  if (on === (current !== undefined)) return;
  if (current) {
    pulses.delete(el);
    current.finished.catch(() => undefined); // cancel() rejects `finished`
    current.cancel();
    el.removeAttribute('data-pulse');
    return;
  }
  if (typeof el.animate !== 'function') return;
  pulses.set(el, el.animate(PULSE_KEYFRAMES, PULSE_TIMING));
  el.setAttribute('data-pulse', '');
}
