import { describe, expect, it } from 'vitest';
import {
  WHATSAPP_URL_LIMIT,
  digestHeading,
  digestLinks,
  formatWhatsAppDigest,
  whatsAppOpenLink,
  whatsAppShareUrl,
} from './whatsapp-digest';
import type { DigestEvent } from './whatsapp-digest';

const base = {
  heading: 'Concerts in Bengaluru · This weekend',
  listingUrl: 'https://rasika.life/bengaluru/concerts/this-weekend',
  eventUrl: (e: DigestEvent) => `https://rasika.life/events/${e.id}`,
  campaign: 'listing_share',
};
const UTM = 'utm_source=whatsapp&utm_medium=social&utm_campaign=listing_share';

const concert: DigestEvent = {
  id: 'e1',
  title: 'Sunil Gargyan - Carnatic Vocal',
  startDateTime: '2026-10-24T13:00:00Z',
  venueName: 'Sri Sringeri Shankara Math',
  artists: [
    { title: 'Vid.', name: 'Sunil Gargyan', role: 'vocal' },
    { name: 'Keshav Mohankumar', role: 'violin' },
  ],
  entryType: 'ticketed',
  ticketing: { url: 'https://example.com/tickets' },
};

describe('formatWhatsAppDigest', () => {
  it('groups by day and prints time in India, cast, venue, entry and tickets', () => {
    expect(formatWhatsAppDigest([concert], base)).toBe(
      [
        '*Concerts in Bengaluru · This weekend*',
        '',
        '── Sat, 24 Oct ──',
        '',
        '*Sunil Gargyan - Carnatic Vocal*',
        'Vid. Sunil Gargyan (vocal), Keshav Mohankumar (violin)',
        '📍 Sri Sringeri Shankara Math',
        '⏰ 6:30 pm · Ticketed',
        '🎟 https://example.com/tickets',
        `https://rasika.life/events/e1?${UTM}&utm_content=event`,
        '',
        `More on Rasika.life: https://rasika.life/bengaluru/concerts/this-weekend?${UTM}&utm_content=listing`,
      ].join('\n')
    );
  });

  it('leads with the performers when the title is generic', () => {
    const text = formatWhatsAppDigest(
      [{ ...concert, title: 'Carnatic Music Concert', entryType: 'free', ticketing: null }],
      { ...base, cast: false }
    );
    expect(text).toContain('*Sunil Gargyan, Keshav Mohankumar*');
    expect(text).not.toContain('(violin)');
    expect(text).toContain('⏰ 6:30 pm · Free');
    expect(text).not.toContain('🎟');
  });

  it('prints each name once when the performers lead and the cast line is on', () => {
    const text = formatWhatsAppDigest([{ ...concert, title: 'Carnatic Music Concert' }], base);
    expect(text).toContain('*Vid. Sunil Gargyan (vocal), Keshav Mohankumar (violin)*\n📍');
    expect(text.match(/Keshav Mohankumar/g)).toHaveLength(1);
  });

  it('writes a stored role slug as words', () => {
    const text = formatWhatsAppDigest(
      [{ ...concert, artists: [{ name: 'R. K. Hegde', role: 'chief-guest' }] }],
      base
    );
    expect(text).toContain('R. K. Hegde (chief guest)');
  });

  it('adds a link per event unless turned off', () => {
    expect(formatWhatsAppDigest([concert], base)).toContain(
      `https://rasika.life/events/e1?${UTM}&utm_content=event`
    );
    expect(formatWhatsAppDigest([concert], { ...base, links: false })).not.toContain('/events/e1');
  });

  it('strips WhatsApp markup out of stored text', () => {
    const text = formatWhatsAppDigest([{ ...concert, title: 'Raga_Sudha *Live*' }], base);
    expect(text).toContain('*RagaSudha Live*');
  });

  it('tags only rasika.life links, never the ticket seller', () => {
    expect(formatWhatsAppDigest([concert], base)).toContain('🎟 https://example.com/tickets\n');
  });

  it('stops at the cap and points at the listing', () => {
    const many = Array.from({ length: 3 }, (_, i) => ({ ...concert, id: `e${i}` }));
    const text = formatWhatsAppDigest(many, { ...base, max: 2 });
    expect(text.match(/Sunil Gargyan - Carnatic Vocal/g)).toHaveLength(2);
    expect(text).toMatch(/…and 1 more: https:\/\/rasika\.life\/bengaluru/);
  });

  it('names the zone of a concert outside India, and only then', () => {
    const text = formatWhatsAppDigest(
      [{ ...concert, startDateTime: '2026-10-25T02:30:00Z', timezone: 'America/Los_Angeles' }],
      base
    );
    expect(text).toContain('⏰ 7:30 pm PDT · Ticketed');
    expect(formatWhatsAppDigest([concert], base)).not.toContain('IST');
  });

  it('says so when nothing is listed', () => {
    expect(formatWhatsAppDigest([], base)).toContain('Nothing listed yet.');
  });

  it('never prints a ticket link that is not a web address', () => {
    const text = formatWhatsAppDigest([{ ...concert, ticketing: { url: 'call 98450' } }], base);
    expect(text).not.toContain('🎟');
  });
});

describe('short links', () => {
  const listing = `https://rasika.life/bengaluru/concerts/this-weekend?${UTM}&utm_content=listing`;
  const event = `https://rasika.life/events/e1?${UTM}&utm_content=event`;

  it('lists the tagged links the text will hold', () => {
    expect(digestLinks([concert], base)).toEqual([listing, event]);
    expect(digestLinks([concert], { ...base, links: false })).toEqual([listing]);
  });

  it('prints a short link where one is known and the full link otherwise', () => {
    const text = formatWhatsAppDigest([concert], {
      ...base,
      links: true,
      shortLinks: { [listing]: 'https://rasika.life/l/abc1234' },
    });
    expect(text).toContain('More on Rasika.life: https://rasika.life/l/abc1234');
    expect(text).toContain(event);
    expect(text).not.toContain(listing);
  });

  it('still lets Open in WhatsApp find the listing link to shorten towards', () => {
    const text = formatWhatsAppDigest(Array(30).fill(concert), {
      ...base,
      shortLinks: { [listing]: 'https://rasika.life/l/abc1234' },
    });
    const open = whatsAppOpenLink(text, 1500);
    expect(open?.shortened).toBe(true);
    expect(decodeURIComponent(open?.url ?? '')).toContain('more: https://rasika.life/l/abc1234');
  });
});

describe('whatsAppShareUrl', () => {
  it('encodes the text', () => {
    expect(whatsAppShareUrl('a b\n*c*')).toBe('https://wa.me/?text=a%20b%0A*c*');
  });
});

describe('digestHeading', () => {
  it('names the actual dates beside a relative range', () => {
    expect(
      digestHeading({
        cityName: 'Bengaluru',
        range: { from: '2026-10-24', to: '2026-10-25', label: 'This weekend' },
      })
    ).toBe('Concerts in Bengaluru · This weekend, Sat, 24 Oct – Sun, 25 Oct');
  });

  it('shows one date for a single day, and says free when filtered', () => {
    expect(
      digestHeading({
        cityName: 'Bengaluru',
        range: { from: '2026-10-24', to: '2026-10-24', label: 'Today' },
        free: true,
      })
    ).toBe('Free concerts in Bengaluru · Today, Sat, 24 Oct');
  });

  it('does not repeat a label that is already a date', () => {
    expect(
      digestHeading({ range: { from: '2026-10-01', to: '2026-10-31', label: 'October 2026' } })
    ).toBe('Concerts · October 2026');
  });

  it('falls back to upcoming when there is no range', () => {
    expect(digestHeading({})).toBe('Upcoming concerts');
    expect(digestHeading({ cityName: 'Chennai', free: true, range: null })).toBe(
      'Upcoming free concerts in Chennai'
    );
  });

  it('never uses an em dash', () => {
    expect(
      digestHeading({ range: { from: '2026-10-24', to: '2026-10-25', label: 'This weekend' } })
    ).not.toContain('—');
  });
});

describe('whatsAppOpenLink', () => {
  const many = (n: number) =>
    formatWhatsAppDigest(
      Array.from({ length: n }, (_, i) => ({
        ...concert,
        id: `e${i}`,
        startDateTime: `2026-10-${String(10 + (i % 15)).padStart(2, '0')}T13:00:00Z`,
      })),
      base
    );

  it('opens the whole text when it fits', () => {
    const text = many(2);
    expect(whatsAppOpenLink(text)).toEqual({ url: whatsAppShareUrl(text), shortened: false });
  });

  it('drops events from the end and counts them in the footer when it does not', () => {
    const text = many(30);
    expect(whatsAppShareUrl(text).length).toBeGreaterThan(WHATSAPP_URL_LIMIT);
    const link = whatsAppOpenLink(text);
    expect(link?.shortened).toBe(true);
    expect(link?.url.length).toBeLessThanOrEqual(WHATSAPP_URL_LIMIT);
    const short = decodeURIComponent(link?.url.replace('https://wa.me/?text=', '') ?? '');
    const kept = short.match(/Sunil Gargyan - Carnatic Vocal/g)?.length ?? 0;
    expect(kept).toBeGreaterThan(0);
    expect(short).toContain(`…and ${30 - kept} more: https://rasika.life/bengaluru`);
    // No day header is left with nothing under it.
    expect(short).not.toMatch(/──\n\n…and/);
  });

  it('adds to a count the digest already had', () => {
    const events = Array.from({ length: 40 }, (_, i) => ({ ...concert, id: `e${i}` }));
    const text = formatWhatsAppDigest(events, base);
    const short = decodeURIComponent(
      whatsAppOpenLink(text)?.url.replace('https://wa.me/?text=', '') ?? ''
    );
    const kept = short.match(/Sunil Gargyan - Carnatic Vocal/g)?.length ?? 0;
    expect(short).toContain(`…and ${40 - kept} more:`);
  });

  it('gives up when not even one event fits', () => {
    expect(whatsAppOpenLink(many(3), 200)).toBeNull();
  });
});
