type Rgb = [number, number, number];

const parse = (hex: string): Rgb => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`expected #rrggbb, got ${hex}`);
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (c: Rgb): string =>
  '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** CSS `color-mix(in srgb, a, b pct%)`. */
export function mix(a: string, b: string, pct: number): string {
  const x = parse(a);
  const y = parse(b);
  const t = pct / 100;
  return toHex([0, 1, 2].map((i) => (x[i] ?? 0) * (1 - t) + (y[i] ?? 0) * t) as Rgb);
}

const luminance = (hex: string): number => {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
