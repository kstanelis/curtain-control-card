import { vi } from 'vitest';
import '../../src/curtain-control-card';
import type { CurtainControlCard } from '../../src/curtain-control-card';
import type { FakeHass } from './hass';

/** Card size the fake ResizeObserver reports; reset by installCardEnv(). */
export const size = { w: 440, h: 360 };

/** ResizeObserver stand-in: reports `size` for the observed element on observe. */
class FakeResizeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element): void {
    Object.defineProperty(target, 'clientWidth', { configurable: true, value: size.w });
    Object.defineProperty(target, 'clientHeight', { configurable: true, value: size.h });
    this.cb([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect(): void {
    // nothing to release
  }
}

/** Call in beforeEach: fake ResizeObserver, default size. */
export function installCardEnv(): void {
  size.w = 440;
  size.h = 360;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
}

/** Call in afterEach. */
export function resetCardEnv(): void {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
}

export const full = (pos: number) => ({
  state: 'open',
  attributes: {
    current_position: pos,
    supported_features: 15,
    friendly_name: `Cover ${String(pos)}`,
  },
});

export async function mount(
  config: Record<string, unknown>,
  hass: FakeHass,
  layout?: string,
): Promise<CurtainControlCard> {
  const el = document.createElement('curtain-control-card');
  el.setConfig({ type: 'custom:curtain-control-card', ...config });
  el.hass = hass;
  if (layout) el.layout = layout;
  document.body.appendChild(el);
  await el.updateComplete;
  await el.updateComplete; // second pass after the first ResizeObserver report
  return el;
}

const root = (el: Element): ShadowRoot => {
  if (!el.shadowRoot) throw new Error('no shadow root');
  return el.shadowRoot;
};
export const q = (el: Element, sel: string): HTMLElement | null =>
  root(el).querySelector<HTMLElement>(sel);
/** Like q, but the element must exist. */
export const one = (el: Element, sel: string): HTMLElement => {
  const found = q(el, sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
export const qa = (el: Element, sel: string): HTMLElement[] => [
  ...root(el).querySelectorAll<HTMLElement>(sel),
];
