import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportsColorMix } from '../../src/ui/css-support';

describe('supportsColorMix', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks CSS.supports about color-mix', () => {
    const supports = vi.fn(() => true);
    vi.stubGlobal('CSS', { supports });
    expect(supportsColorMix()).toBe(true);
    expect(supports).toHaveBeenCalledWith('color', 'color-mix(in srgb, red, blue)');
  });

  it('is false when the engine says no or CSS is missing', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    expect(supportsColorMix()).toBe(false);
    vi.stubGlobal('CSS', undefined);
    expect(supportsColorMix()).toBe(false);
  });
});
