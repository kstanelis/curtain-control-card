import { describe, expect, it } from 'vitest';

describe('bundle entry', () => {
  it('registers the card element', async () => {
    await import('../src/curtain-control-card');
    expect(customElements.get('curtain-control-card')).toBeDefined();
  });
});
