import { buildEventCardContent } from '@rasika/core/shared/event-card';
import { describe, expect, it } from 'vitest';
import { CARD_VERSION } from './card';
import { EVENT_CARD_COLORS, buildEventSvg, eventCardKey } from './event-card';

const content = buildEventCardContent({
  title: 'Margazhi Vocal Recital',
  startDateTime: '2026-12-12T12:30:00.000Z',
  artists: [
    { title: 'Vid.', name: 'Sunil Gargyan', role: 'vocal' },
    { name: 'Keshav Mohankumar', role: 'violin' },
  ],
  venueName: 'Narada Gana Sabha',
  city: 'Chennai',
});

function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('buildEventSvg', () => {
  it('draws every field of the content and the wordmark', () => {
    const svg = buildEventSvg(content);
    for (const text of [
      'Margazhi Vocal Recital',
      'Vid. Sunil Gargyan',
      'violin',
      'Narada Gana Sabha, Chennai',
      'rasika.life',
      '6:00 pm',
      '12 Dec',
    ]) {
      expect(svg).toContain(text);
    }
  });

  it('draws nothing for an empty field', () => {
    const svg = buildEventSvg(
      buildEventCardContent({ title: 'Recital', startDateTime: '2026-12-12T12:30:00.000Z' })
    );
    expect(svg).not.toContain('more');
    expect(svg).not.toContain('Chennai');
    expect(svg.match(/<text /g)).toHaveLength(3); // wordmark, date line, title
  });

  it('escapes markup and draws no diacritics', () => {
    const svg = buildEventSvg(
      buildEventCardContent({
        title: 'A & B <Śrī>',
        startDateTime: '2026-12-12T12:30:00.000Z',
      })
    );
    expect(svg).toContain('A &amp; B &lt;Sri&gt;');
    expect(svg).not.toMatch(/[\p{M}\u0100-\u024F\u1E00-\u1EFF]/u);
  });

  it('counts the artists cut', () => {
    const artists = Array.from({ length: 7 }, (_, i) => ({ name: `Artist ${i}` }));
    const svg = buildEventSvg(
      buildEventCardContent({
        title: 'Festival',
        startDateTime: '2026-12-12T12:30:00.000Z',
        artists,
      })
    );
    expect(svg).toContain('and 3 more');
  });

  it('fits a long title inside the card width', () => {
    const long = buildEventCardContent({
      title: 'W'.repeat(200),
      startDateTime: '2026-12-12T12:30:00.000Z',
    });
    const size = Number(
      buildEventSvg(long).match(/font-size="(\d+)" font-weight="bold" fill="#ffede5"/)?.[1]
    );
    expect(size).toBeGreaterThan(0);
  });
});

describe('eventCardKey', () => {
  it('is stable for unchanged content and moves when the content or version changes', () => {
    expect(eventCardKey('e1', content)).toBe(eventCardKey('e1', structuredClone(content)));
    expect(eventCardKey('e1', content)).not.toBe(
      eventCardKey('e1', { ...content, time: '7:00 pm' })
    );
    expect(eventCardKey('e1', content)).toMatch(/^og-images\/event\/e1-[0-9a-f]{12}\.jpg$/);
    expect(CARD_VERSION).toBeTruthy();
  });
});

describe('palette', () => {
  it.each(['accent', 'text', 'quiet'] as const)('%s reads on the background at WCAG AA', name => {
    expect(ratio(EVENT_CARD_COLORS[name], EVENT_CARD_COLORS.background)).toBeGreaterThanOrEqual(
      4.5
    );
  });
});
