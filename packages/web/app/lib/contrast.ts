/**
 * WCAG relative-luminance and contrast maths, used by the token contrast test.
 *
 * It lives in app code rather than the test file because the numbers it produces are the
 * reason `--primary` differs between light and dark mode; anyone changing a colour token
 * should be able to run these against a candidate value before committing to it.
 */

/** HSL as authored in globals.css (`h s% l%`) to sRGB in 0..1. Hue wraps, so -21 is 339. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA for body text. Large text (>=18.66px bold or >=24px) may use 3. */
export const AA_NORMAL_TEXT = 4.5;

/** WCAG AA 1.4.11 for non-text indicators: focus rings, borders that carry meaning, icons. */
export const AA_NON_TEXT = 3;
