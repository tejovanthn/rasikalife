import { describe, expect, it } from 'vitest';
import { formatWhatsAppDigest, whatsAppShareUrl } from './whatsapp-digest';
import type { DigestEvent } from './whatsapp-digest';

const base = {
  heading: 'Concerts in Bengaluru · This weekend',
  listingUrl: 'https://rasika.life/bengaluru/concerts/this-weekend',
  eventUrl: (e: DigestEvent) => `https://rasika.life/events/${e.id}`,
};

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
        '🕕 6:30 pm · Ticketed',
        '🎟 https://example.com/tickets',
        '',
        'More on Rasika.life: https://rasika.life/bengaluru/concerts/this-weekend',
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
    expect(text).toContain('🕕 6:30 pm · Free');
    expect(text).not.toContain('🎟');
  });

  it('adds a link per event only when asked', () => {
    expect(formatWhatsAppDigest([concert], base)).not.toContain('/events/e1');
    expect(formatWhatsAppDigest([concert], { ...base, links: true })).toContain(
      'https://rasika.life/events/e1'
    );
  });

  it('strips WhatsApp markup out of stored text', () => {
    const text = formatWhatsAppDigest([{ ...concert, title: 'Raga_Sudha *Live*' }], base);
    expect(text).toContain('*RagaSudha Live*');
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
    expect(text).toContain('🕕 7:30 pm PDT · Ticketed');
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

describe('whatsAppShareUrl', () => {
  it('encodes the text', () => {
    expect(whatsAppShareUrl('a b\n*c*')).toBe('https://wa.me/?text=a%20b%0A*c*');
  });
});
