import { describe, expect, it } from 'vitest';
import { PALETTES, themeTokens } from '../../src/model/theme';
import { contrast, mix } from '../helpers/color';

describe('themeTokens — base palette (spec §8)', () => {
  it('dark', () => {
    expect(themeTokens('dark', undefined, true)).toMatchObject({
      '--cc-card': '#1c1c1c',
      '--cc-text': '#e1e1e1',
      '--cc-muted': '#9b9b9b',
      '--cc-border': '#2f2f2f',
      '--cc-accent': '#03a9f4',
    });
  });

  it('light', () => {
    expect(themeTokens('light', undefined, true)).toMatchObject({
      '--cc-card': '#ffffff',
      '--cc-text': '#212121',
      '--cc-muted': '#727272',
      '--cc-border': '#e0e0e0',
      '--cc-accent': '#03a9f4',
    });
  });

  it('auto follows HA theme variables', () => {
    expect(themeTokens('auto', undefined, true)).toMatchObject({
      '--cc-card': 'var(--card-background-color, #fff)',
      '--cc-text': 'var(--primary-text-color, #212121)',
      '--cc-muted': 'var(--secondary-text-color, #727272)',
      '--cc-border': 'var(--divider-color, #e0e0e0)',
      '--cc-accent': 'var(--primary-color, #03a9f4)',
    });
  });

  it.each(['auto', 'light', 'dark'] as const)('accent option overrides in %s', (mode) => {
    expect(themeTokens(mode, '#e0a24a', true)['--cc-accent']).toBe('#e0a24a');
  });
});

describe('themeTokens — derived tokens', () => {
  it('uses color-mix when supported', () => {
    expect(themeTokens('dark', undefined, true)).toMatchObject({
      '--cc-track': 'color-mix(in srgb, var(--cc-card), var(--cc-text) 12%)',
      '--cc-button': 'color-mix(in srgb, var(--cc-card), var(--cc-text) 7%)',
      '--cc-accent-text': 'color-mix(in srgb, var(--cc-accent), var(--cc-text) 45%)',
      '--cc-accent-tint': 'color-mix(in srgb, var(--cc-card), var(--cc-accent) 25%)',
      '--cc-on-accent': 'color-mix(in srgb, var(--cc-accent), #000 55%)',
      '--cc-window': 'color-mix(in srgb, var(--cc-card), #5b8db8 35%)',
    });
  });

  it.each([
    ['auto', true],
    ['dark', false],
    ['light', true],
  ] as const)('fixed semantic colours never change (%s, colorMix %s)', (mode, cm) => {
    expect(themeTokens(mode, '#7e57c2', cm)).toMatchObject({
      '--cc-fabric-a': '#d8c7a8',
      '--cc-fabric-b': '#c4b190',
      '--cc-handle': '#f4efe6',
      '--cc-chip-bg': 'rgba(0,0,0,0.6)',
      '--cc-chip-text': '#ffffff',
    });
  });

  it('auto without color-mix falls back to HA variables and plain tokens', () => {
    expect(themeTokens('auto', undefined, false)).toMatchObject({
      '--cc-track': 'var(--secondary-background-color, #e5e5e5)',
      '--cc-button': 'var(--secondary-background-color, #e5e5e5)',
      '--cc-accent-text': 'var(--cc-text)',
      '--cc-accent-tint': 'var(--cc-border)',
      '--cc-on-accent': 'rgba(0,0,0,0.45)',
      '--cc-window': '#5b8db8',
    });
  });

  it('forced themes without color-mix use precomputed literals', () => {
    expect(themeTokens('dark', undefined, false)).toMatchObject({
      '--cc-track': '#343434',
      '--cc-button': '#2a2a2a',
    });
    expect(themeTokens('light', undefined, false)).toMatchObject({
      '--cc-track': '#e4e4e4',
      '--cc-button': '#efefef',
    });
  });

  it.each(['dark', 'light'] as const)('%s literals equal the color-mix result', (mode) => {
    const p = PALETTES[mode];
    const t = themeTokens(mode, undefined, false);
    expect(t['--cc-track']).toBe(mix(p.card, p.text, 12));
    expect(t['--cc-button']).toBe(mix(p.card, p.text, 7));
  });
});

describe('contrast (spec §8 target ≥ 4.5:1)', () => {
  const accents = ['#03a9f4', '#e0a24a', '#7e57c2'];

  it.each(['dark', 'light'] as const)('accent-text on %s card for blue, amber, purple', (mode) => {
    const p = PALETTES[mode];
    for (const a of accents) {
      expect(contrast(mix(a, p.text, 45), p.card), a).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('accent-text with the HA 2026.11 default palette (seen on real HA)', () => {
    // auto mode resolves to these: primary #009ac7, light text #141414, dark text #e1e1e1
    expect(contrast(mix('#009ac7', '#141414', 45), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(mix('#009ac7', '#e1e1e1', 45), '#1c1c1c')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#5e5e5e', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['dark', 'light'] as const)('muted on %s card', (mode) => {
    const p = PALETTES[mode];
    expect(contrast(p.muted, p.card)).toBeGreaterThanOrEqual(4.5);
  });

  it('readout chip text ≥ 7:1 on chip over the lightest fabric stripe', () => {
    // rgba(0,0,0,0.6) over #d8c7a8 = 40% of the stripe
    expect(contrast('#ffffff', mix('#d8c7a8', '#000000', 60))).toBeGreaterThanOrEqual(7);
  });
});
