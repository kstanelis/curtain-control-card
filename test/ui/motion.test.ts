import { describe, expect, it, vi } from 'vitest';
import { PULSE_KEYFRAMES, PULSE_TIMING, syncPulse } from '../../src/ui/motion';

/** Element whose animate() returns a controllable fake Animation. */
function target() {
  const el = document.createElement('div');
  const animations: { cancel: ReturnType<typeof vi.fn>; finished: Promise<unknown> }[] = [];
  const animate = vi.fn(() => {
    let reject: (e: unknown) => void = () => undefined;
    const finished = new Promise((_, r) => {
      reject = r;
    });
    const a = {
      finished,
      cancel: vi.fn(() => {
        reject(new DOMException('aborted', 'AbortError'));
      }),
    };
    animations.push(a);
    return a as unknown as Animation;
  });
  el.animate = animate;
  return { el, animate, animations };
}

describe('syncPulse', () => {
  it('running starts one pulse: opacity 1 → 0.35 → 1, 1.2 s, ease-in-out, forever', () => {
    const { el, animate } = target();
    syncPulse(el, true, false);
    expect(animate).toHaveBeenCalledWith(PULSE_KEYFRAMES, PULSE_TIMING);
    expect(PULSE_KEYFRAMES).toEqual([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }]);
    expect(PULSE_TIMING).toEqual({ duration: 1200, iterations: Infinity, easing: 'ease-in-out' });
    expect(el.hasAttribute('data-pulse')).toBe(true);
  });

  it('calling again while running keeps the same animation', () => {
    const { el, animate } = target();
    syncPulse(el, true, false);
    syncPulse(el, true, false);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('stopping cancels it and swallows the finished rejection', async () => {
    const { el, animations } = target();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    syncPulse(el, true, false);
    syncPulse(el, false, false);
    expect(animations[0]?.cancel).toHaveBeenCalledTimes(1);
    expect(el.hasAttribute('data-pulse')).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('reduced motion: no animation, and an existing one is cancelled', () => {
    const { el, animate, animations } = target();
    syncPulse(el, true, true);
    expect(animate).not.toHaveBeenCalled();
    syncPulse(el, true, false);
    syncPulse(el, true, true);
    expect(animations[0]?.cancel).toHaveBeenCalledTimes(1);
  });

  it('restarts after a stop', () => {
    const { el, animate } = target();
    syncPulse(el, true, false);
    syncPulse(el, false, false);
    syncPulse(el, true, false);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('stopping an element that never pulsed is a no-op', () => {
    const { el } = target();
    expect(() => {
      syncPulse(el, false, false);
    }).not.toThrow();
  });

  it('does nothing where the Web Animations API is missing', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'animate', { value: undefined });
    expect(() => {
      syncPulse(el, true, false);
    }).not.toThrow();
    expect(el.hasAttribute('data-pulse')).toBe(false);
  });
});
