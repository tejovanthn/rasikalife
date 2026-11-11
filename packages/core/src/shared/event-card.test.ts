import { describe, expect, it } from 'vitest';
import { CARD_ARTIST_MAX, CARD_TITLE_MAX, buildEventCardContent, truncate } from './event-card';

const base = {
  title: 'Margazhi Utsavam: Vocal Recital',
  startDateTime: '2026-12-12T12:30:00.000Z', // 6:00 pm IST
};

describe('buildEventCardContent', () => {
  it('prints date and time in the event zone, not UTC', () => {
    const c = buildEventCardContent(base);
    expect(c.time).toBe('6:00 pm');
    expect(c.date).toBe('Sat, 12 Dec, 2026');
  });

  it('puts the day in the event zone when UTC is another day', () => {
    const c = buildEventCardContent({ ...base, startDateTime: '2026-12-12T19:00:00.000Z' });
    expect(c.date).toBe('Sun, 13 Dec, 2026'); // 12:30 am IST
  });

  it('names the zone only outside India', () => {
    const c = buildEventCardContent({ ...base, timezone: 'America/Los_Angeles' });
    expect(c.time).toBe('4:30 am PST');
  });

  it('prints an end time only when it is after the start', () => {
    expect(buildEventCardContent({ ...base, endDateTime: '2026-12-12T15:00:00.000Z' }).time).toBe(
      '6:00 pm – 8:30 pm'
    );
    expect(buildEventCardContent({ ...base, endDateTime: '2026-12-12T10:00:00.000Z' }).time).toBe(
      '6:00 pm'
    );
  });

  it('omits every empty field', () => {
    const c = buildEventCardContent({ ...base, artists: [], venueName: ' ', city: '' });
    expect(c.artists).toEqual([]);
    expect(c.moreArtists).toBe(0);
    expect(c).not.toHaveProperty('place');
  });

  it('omits an unusable time rather than inventing one', () => {
    const c = buildEventCardContent({ ...base, startDateTime: 'not a date' });
    expect(c).not.toHaveProperty('time');
    expect(c).not.toHaveProperty('date');
  });

  it('lists artists with title and role, dropping blank names and roles', () => {
    const c = buildEventCardContent({
      ...base,
      artists: [
        { title: 'Vid.', name: 'Sunil Gargyan', role: 'vocal' },
        { name: 'Keshav Mohankumar', role: 'chief-guest' },
        { name: '  ' },
        { name: 'No Role', role: '' },
      ],
    });
    expect(c.artists).toEqual([
      { name: 'Vid. Sunil Gargyan', role: 'vocal' },
      { name: 'Keshav Mohankumar', role: 'chief guest' },
      { name: 'No Role' },
    ]);
  });

  it('shows names in the roman script: no diacritics or combining marks anywhere', () => {
    const c = buildEventCardContent({
      title: 'Śrī Tyāgarāja Ārādhanā',
      startDateTime: base.startDateTime,
      artists: [{ title: 'Vid.', name: 'Śrīvidyā Rāmaṇ', role: 'vīṇā' }],
      venueName: 'Kṛṣṇa Gāna Sabhā',
      city: 'Cennai\u0301',
    });
    expect(c.title).toBe('Sri Tyagaraja Aradhana');
    expect(c.artists).toEqual([{ name: 'Vid. Srividya Raman', role: 'vina' }]);
    expect(c.place).toBe('Krsna Gana Sabha, Cennai');
    expect(JSON.stringify(c)).not.toMatch(/[\p{M}\u0100-\u024F\u1E00-\u1EFF]/u);
  });

  it('romanizes a generic title that falls back to the lead artist', () => {
    const c = buildEventCardContent({
      ...base,
      title: 'Carnatic Music Concert',
      artists: [{ name: 'Śrīvidyā Rāmaṇ' }],
    });
    expect(c.title).toBe('Srividya Raman');
  });

  it('caps the cast and counts the rest', () => {
    const artists = Array.from({ length: 7 }, (_, i) => ({ name: `Artist ${i}` }));
    const c = buildEventCardContent({ ...base, artists });
    expect(c.artists).toHaveLength(CARD_ARTIST_MAX);
    expect(c.moreArtists).toBe(3);
  });

  it('truncates a long title and a long name with an ellipsis', () => {
    const c = buildEventCardContent({
      ...base,
      title: 'x'.repeat(200),
      artists: [{ name: 'y'.repeat(200) }],
    });
    expect([...c.title]).toHaveLength(CARD_TITLE_MAX);
    expect(c.title.endsWith('…')).toBe(true);
    expect(c.artists[0].name.endsWith('…')).toBe(true);
  });

  describe('generic titles', () => {
    it('heads the card with the lead artist and keeps the rest as the cast', () => {
      const c = buildEventCardContent({
        ...base,
        title: 'Carnatic Music Concert',
        artists: [
          { title: 'Vid.', name: 'Sunil Gargyan', role: 'vocal' },
          { name: 'Keshav Mohankumar', role: 'violin' },
        ],
      });
      expect(c.title).toBe('Vid. Sunil Gargyan');
      expect(c.artists).toEqual([{ name: 'Keshav Mohankumar', role: 'violin' }]);
    });

    it('falls back to the venue when no artist is named', () => {
      const c = buildEventCardContent({
        ...base,
        title: 'Carnatic Music Concert',
        venueName: 'Narada Gana Sabha',
      });
      expect(c.title).toBe('Narada Gana Sabha');
    });

    it('keeps a generic title when there is nothing better', () => {
      expect(buildEventCardContent({ ...base, title: 'Carnatic Music Concert' }).title).toBe(
        'Carnatic Music Concert'
      );
    });

    it('leaves a specific title alone', () => {
      expect(buildEventCardContent({ ...base, artists: [{ name: 'A' }] }).title).toBe(base.title);
    });
  });

  describe('place', () => {
    it('joins venue and city', () => {
      expect(
        buildEventCardContent({ ...base, venueName: 'Narada Gana Sabha', city: 'Chennai' }).place
      ).toBe('Narada Gana Sabha, Chennai');
    });
    it('does not repeat a city the venue name holds', () => {
      expect(
        buildEventCardContent({ ...base, venueName: 'Chennai Music Hall', city: 'Chennai' }).place
      ).toBe('Chennai Music Hall');
    });
    it('shows the city alone when there is no venue', () => {
      expect(buildEventCardContent({ ...base, city: 'Chennai' }).place).toBe('Chennai');
    });
  });
});

describe('truncate', () => {
  it('leaves short text alone and counts code points', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('abcd', 3)).toBe('ab…');
  });
});
