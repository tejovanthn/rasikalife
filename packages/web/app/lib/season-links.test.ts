import { describe, expect, it } from 'vitest';
import { chennaiSeasonYear, seasonLinks } from './season-links';

// India is UTC+5:30, so these are written as IST wall time.
const ist = (iso: string) => new Date(`${iso}+05:30`);

describe('chennaiSeasonYear', () => {
  it('is null before October', () => {
    expect(chennaiSeasonYear(ist('2026-09-30T23:59:00'))).toBeNull();
  });
  it('starts on 1 October and names that year', () => {
    expect(chennaiSeasonYear(ist('2026-10-01T00:00:00'))).toBe(2026);
    expect(chennaiSeasonYear(ist('2026-11-26T12:00:00'))).toBe(2026);
    expect(chennaiSeasonYear(ist('2026-12-31T23:59:00'))).toBe(2026);
  });
  it('keeps the season year through 15 January', () => {
    expect(chennaiSeasonYear(ist('2027-01-01T00:00:00'))).toBe(2026);
    expect(chennaiSeasonYear(ist('2027-01-15T23:59:00'))).toBe(2026);
  });
  it('ends on 16 January', () => {
    expect(chennaiSeasonYear(ist('2027-01-16T00:00:00'))).toBeNull();
    expect(chennaiSeasonYear(ist('2027-06-01T00:00:00'))).toBeNull();
  });
  it('reads the date in India, not UTC', () => {
    // 31 Dec 2026 20:00 UTC is already 1 Jan 2027 in India: still season 2026.
    expect(chennaiSeasonYear(new Date('2026-12-31T20:00:00Z'))).toBe(2026);
    // 15 Jan 2027 19:00 UTC is 16 Jan 00:30 in India: over.
    expect(chennaiSeasonYear(new Date('2027-01-15T19:00:00Z'))).toBeNull();
  });
});

describe('seasonLinks', () => {
  it('names the December season in season, with the computed year', () => {
    const links = seasonLinks(ist('2026-11-26T10:00:00'));
    expect(links.map(l => l.href)).toEqual(['/events/chennai', '/events/bengaluru']);
    expect(links[0].text).toBe('Chennai December Season 2026 concerts');
    expect(links[1].text).toBe('Carnatic concerts in Bengaluru');
  });
  it('falls back to the plain text out of season', () => {
    expect(seasonLinks(ist('2027-03-01T10:00:00'))[0].text).toBe('Carnatic concerts in Chennai');
  });
  it('puts the page city first, whatever the spelling', () => {
    expect(seasonLinks(ist('2026-11-26T10:00:00'), 'Bangalore').map(l => l.slug)).toEqual([
      'bengaluru',
      'chennai',
    ]);
    expect(seasonLinks(ist('2026-11-26T10:00:00'), 'Madras')[0].slug).toBe('chennai');
    expect(seasonLinks(ist('2026-11-26T10:00:00'), 'Pune')[0].slug).toBe('chennai');
  });
});
