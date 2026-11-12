/**
 * Print colours, from the design tokens in the root DESIGN.md. They are RGB hex there and RGB
 * here. A print vendor converts to CMYK, and the orange may shift slightly.
 */
export const PALETTE = {
  hallLight: '#ffede5',
  firedEarthenware: '#bc4110',
  warmWhite: '#fffbfa',
  ink: '#181310',
  lampBlack: '#130a06',
} as const;

export type Rgb = [number, number, number];

/** `#rrggbb` as three numbers from 0 to 1, the form pdf-lib and the typesetter take. */
export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function channel(v: number): number {
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const COLOR = {
  hallLight: hexToRgb(PALETTE.hallLight),
  fired: hexToRgb(PALETTE.firedEarthenware),
  warmWhite: hexToRgb(PALETTE.warmWhite),
  ink: hexToRgb(PALETTE.ink),
  lampBlack: hexToRgb(PALETTE.lampBlack),
};
