import type { EventCardContent } from '@rasika/core/shared/event-card';
import {
  CARD_HEIGHT,
  CARD_VERSION,
  CARD_WIDTH,
  contentHash,
  escapeXml,
  estimateTextWidth,
  fitTitle,
} from './card';

// Share card for an event with no poster. Pure, like card.ts: the handler resolves the record,
// `buildEventCardContent` (shared with the event page's HTML card) decides what it says, and this
// only draws it. Nothing here adds a fact.

// DESIGN.md tokens, dark mode (hue 17): lamp-black, fired-earthenware-dark, hall-light,
// quiet-ink-dark. event-card.test.ts checks each text colour against the background for WCAG AA.
export const EVENT_CARD_COLORS = {
  background: '#130a06',
  accent: '#ed5e25',
  text: '#ffede5',
  quiet: '#9e9794',
} as const;

// DejaVu Sans covers Latin Extended Additional, so IAST diacritics (ā ī ū ṇ ṭ ṣ ś ṛ ṅ) render as
// glyphs and not as boxes. Keep it first: the Lambda resolves the stack against Amazon Linux.
const FONT = 'DejaVu Sans,Arial,sans-serif';
const X = 56;
const BUDGET = CARD_WIDTH - X * 2;
const NAME_SIZE = 32;
const ROLE_SIZE = 24;
const LINE_STEP = 46;

/** Cache key: folds in everything that changes the picture, so an unchanged event costs nothing. */
export function eventCardKey(eventId: string, content: EventCardContent): string {
  return `og-images/event/${eventId}-${contentHash([CARD_VERSION, JSON.stringify(content)])}.jpg`;
}

function fitLine(text: string, size: number, budget: number): string {
  if (estimateTextWidth(text, size) <= budget) return text;
  let out = text;
  while (out.length > 1 && estimateTextWidth(`${out}…`, size) > budget) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

export function buildEventSvg(content: EventCardContent): string {
  const when = [content.date, content.time].filter(Boolean).join('  ·  ');
  const title = fitTitle(content.title, false);

  const parts: string[] = [];
  let y = 150;
  if (when) {
    parts.push(
      `<text x="${X}" y="${y}" font-family="${FONT}" font-size="30" font-weight="bold" fill="${EVENT_CARD_COLORS.accent}">${escapeXml(fitLine(when, 30, BUDGET))}</text>`
    );
    y += 40;
  }
  y += title.fontSize * 0.85;
  parts.push(
    `<text x="${X}" y="${Math.round(y)}" font-family="${FONT}" font-size="${title.fontSize}" font-weight="bold" fill="${EVENT_CARD_COLORS.text}">${escapeXml(title.text)}</text>`
  );
  y += 24;

  for (const artist of content.artists) {
    y += LINE_STEP;
    const role = artist.role ? ` ${artist.role}` : '';
    const name = fitLine(
      artist.name,
      NAME_SIZE,
      BUDGET - (role ? estimateTextWidth(role, ROLE_SIZE) : 0)
    );
    parts.push(
      `<text x="${X}" y="${Math.round(y)}" font-family="${FONT}" font-size="${NAME_SIZE}" fill="${EVENT_CARD_COLORS.text}">${escapeXml(name)}${
        role
          ? `<tspan font-size="${ROLE_SIZE}" fill="${EVENT_CARD_COLORS.quiet}" dx="10">${escapeXml(artist.role as string)}</tspan>`
          : ''
      }</text>`
    );
  }
  if (content.moreArtists > 0) {
    y += LINE_STEP;
    parts.push(
      `<text x="${X}" y="${Math.round(y)}" font-family="${FONT}" font-size="${ROLE_SIZE}" fill="${EVENT_CARD_COLORS.quiet}">and ${content.moreArtists} more</text>`
    );
  }
  if (content.place) {
    parts.push(
      `<text x="${X}" y="580" font-family="${FONT}" font-size="30" fill="${EVENT_CARD_COLORS.quiet}">${escapeXml(fitLine(content.place, 30, BUDGET))}</text>`
    );
  }

  // The clip is the hard guarantee if the width estimate is optimistic on the Lambda's font.
  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="col"><rect x="0" y="0" width="${CARD_WIDTH - X + 8}" height="${CARD_HEIGHT}"/></clipPath></defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${EVENT_CARD_COLORS.background}"/>
  <rect x="0" y="0" width="6" height="${CARD_HEIGHT}" fill="${EVENT_CARD_COLORS.accent}"/>
  <text x="${X}" y="72" font-family="${FONT}" font-size="26" font-weight="bold" fill="${EVENT_CARD_COLORS.accent}">rasika.life</text>
  <g clip-path="url(#col)">
  ${parts.join('\n  ')}
  </g>
</svg>`;
}
