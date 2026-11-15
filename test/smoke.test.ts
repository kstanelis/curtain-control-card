import { describe, expect, it } from 'vitest';

describe('bundle entry', () => {
  it('exports the card type', async () => {
    const mod = await import('../src/curtain-control-card');
    expect(mod.CARD_TYPE).toBe('curtain-control-card');
  });
});
