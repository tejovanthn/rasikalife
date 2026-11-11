import { createHash } from 'node:crypto';

// Pure card rendering: no AWS clients, no network, no Sharp. Kept out of handler.ts so a unit
// test can exercise it without constructing an S3 client and a tRPC client at module scope.

// Bump when the card's appearance changes (palette, geometry, the fitting rules). Cached
// objects are written `immutable` for a year, so without this every card rendered before a
// redesign (v3: event cards print names in the roman script) keeps serving the old layout until someone empties the S3 prefix by hand.
export const CARD_VERSION = 'v4';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// Right-hand photo panel geometry.
export const PHOTO_PANEL_WIDTH = 440;
export const PHOTO_PANEL_X = CARD_WIDTH - PHOTO_PANEL_WIDTH;

const TEXT_X = 48;
const TEXT_GUTTER = 32;
// The photo panel takes 440px, so the text column is much narrower when a photo is present.
const TEXT_BUDGET_WITH_PHOTO = PHOTO_PANEL_X - TEXT_X - TEXT_GUTTER;
const TEXT_BUDGET_FULL = CARD_WIDTH - TEXT_X * 2;

const FONT_SIZES = [80, 72, 64, 56, 48, 40, 34, 28] as const;

// Approximate advance widths for DejaVu Sans Bold, in em. A character count alone is not a
// width — "WWWWWWWWWWWWWW" and "iiiiiiiiiiiiii" differ by nearly 3x — and the previous ladder
// counted characters, so real names overflowed into the photo.
const NARROW_GLYPHS = new Set([...'ijlItfr.,:;!|\'"()[]{}/\\-']);
const WIDE_GLYPHS = new Set([...'MWmw@%']);

function glyphEm(char: string): number {
  if (char === ' ') return 0.32;
  if (NARROW_GLYPHS.has(char)) return 0.34;
  if (WIDE_GLYPHS.has(char)) return 0.95;
  if (char >= 'A' && char <= 'Z') return 0.72;
  return 0.6;
}

export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) em += glyphEm(char);
  return em * fontSize;
}

// Picks the largest size that fits the budget, and truncates only once the smallest size still
// overflows. Both the size and the truncation come from one width estimate, so they cannot
// drift apart the way two hand-tuned constants did.
export function fitTitle(
  title: string,
  hasPhoto: boolean
): { text: string; fontSize: number; budget: number } {
  const budget = hasPhoto ? TEXT_BUDGET_WITH_PHOTO : TEXT_BUDGET_FULL;
  for (const fontSize of FONT_SIZES) {
    if (estimateTextWidth(title, fontSize) <= budget) return { text: title, fontSize, budget };
  }

  const fontSize = FONT_SIZES[FONT_SIZES.length - 1];
  let text = title;
  while (text.length > 1 && estimateTextWidth(`${text}…`, fontSize) > budget) {
    text = text.slice(0, -1);
  }
  return { text: `${text.trimEnd()}…`, fontSize, budget };
}

// Short, stable digest of everything that changes the rendered card. Not a security hash —
// just enough entropy to move to a new cache key when the output would differ.
//
// The NUL separates fields so a rename that shifts a character across a boundary can't collide
// (['ab','c'] must not hash like ['a','bc']). It must be written as the `\0` escape, never as a
// literal NUL: an actual control byte in the source makes git treat this file as binary, and
// every later change to the card becomes undiffable and unreviewable.
export function contentHash(parts: readonly (string | undefined)[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(`${part ?? ''}\0`);
  return hash.digest('hex').slice(0, 12);
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export function buildSvg(
  title: string,
  subtitle: string,
  typeLabel: string,
  photoDataUri?: string | null
): string {
  const hasPhoto = Boolean(photoDataUri);
  const fitted = fitTitle(title, hasPhoto);
  const safeTitle = escapeXml(fitted.text);
  const safeSubtitle = escapeXml(subtitle);
  const safeTypeLabel = escapeXml(typeLabel);
  const { fontSize } = fitted;
  const titleY = fontSize >= 72 ? 360 : 370;
  const subtitleY = titleY + fontSize * 0.9;

  // The width estimate above is tuned for DejaVu Sans Bold, but the Lambda resolves the font
  // stack against Amazon Linux rather than a machine we can measure here. The clip is the hard
  // guarantee: if the estimate is optimistic, text is cut cleanly at the gutter instead of
  // being sliced mid-glyph by the photograph (which paints after the text).
  const clipWidth = TEXT_X + fitted.budget;
  const photoMarkup = photoDataUri
    ? `
  <rect x="${PHOTO_PANEL_X - 4}" y="0" width="4" height="${CARD_HEIGHT}" fill="#2a1208"/>
  <image x="${PHOTO_PANEL_X}" y="0" width="${PHOTO_PANEL_WIDTH}" height="${CARD_HEIGHT}" href="${photoDataUri}"/>`
    : '';

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="textcol"><rect x="0" y="0" width="${clipWidth}" height="${CARD_HEIGHT}"/></clipPath></defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#0f0a07"/>
  <rect x="0" y="0" width="6" height="${CARD_HEIGHT}" fill="#e06030"/>
  <text x="48" y="72" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" font-weight="bold" fill="#e06030">rasika.life</text>
  <rect x="48" y="240" width="${safeTypeLabel.length * 13 + 40}" height="38" rx="6" fill="#2a1208"/>
  <text x="68" y="266" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="600" fill="#e06030">${safeTypeLabel}</text>
  <g clip-path="url(#textcol)">
    <text x="48" y="${titleY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${safeTitle}</text>
    <text x="48" y="${subtitleY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" fill="#808080">${safeSubtitle}</text>
  </g>${photoMarkup}
</svg>`;
}
