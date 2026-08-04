import { describe, expect, it } from 'vitest';
import { artistMetaDescription, artistTagline, parseInstruments } from './artist-display';

describe('artistTagline', () => {
  it('joins instrument and city', () => {
    expect(artistTagline({ instrument: 'vocal', city: 'Chennai' })).toBe('Vocal · Chennai');
  });

  it('capitalizes the instrument but leaves the city as stored', () => {
    expect(artistTagline({ instrument: 'mridangam', city: 'Bengaluru' })).toBe(
      'Mridangam · Bengaluru'
    );
  });

  it('renders either field on its own without a stray separator', () => {
    expect(artistTagline({ instrument: 'violin' })).toBe('Violin');
    expect(artistTagline({ city: 'Mysuru' })).toBe('Mysuru');
  });

  // Both fields are free text, so a moderator can leave whitespace behind. A blank must
  // read as absent — otherwise the join emits a leading or trailing "·".
  it('treats blank and whitespace-only values as absent', () => {
    expect(artistTagline({ instrument: '  ', city: 'Chennai' })).toBe('Chennai');
    expect(artistTagline({ instrument: 'flute', city: '' })).toBe('Flute');
    expect(artistTagline({})).toBeUndefined();
    expect(artistTagline({ instrument: null, city: null })).toBeUndefined();
  });
});

// `instrument` is a comma-separated list, so a mridangam player who also sings is
// "mridangam, vocal". Capitalizing the raw string cased only the first entry.
describe('parseInstruments', () => {
  it('splits a comma list and cases every entry', () => {
    expect(parseInstruments('mridangam, vocal')).toEqual(['Mridangam', 'Vocal']);
  });

  it('handles a single value', () => {
    expect(parseInstruments('vocal')).toEqual(['Vocal']);
  });

  it('drops blanks from trailing and doubled commas', () => {
    expect(parseInstruments('vocal,, violin,')).toEqual(['Vocal', 'Violin']);
    expect(parseInstruments('  ')).toEqual([]);
  });

  it('returns nothing for absent input', () => {
    expect(parseInstruments()).toEqual([]);
    expect(parseInstruments(null)).toEqual([]);
  });
});

describe('artistTagline with several instruments', () => {
  it('joins instruments with commas and the city with a middot', () => {
    expect(artistTagline({ instrument: 'mridangam, vocal', city: 'Chennai' })).toBe(
      'Mridangam, Vocal · Chennai'
    );
  });

  it('cases every instrument, not only the first', () => {
    expect(artistTagline({ instrument: 'vocal, violin, ghatam' })).toBe('Vocal, Violin, Ghatam');
  });
});

describe('artistMetaDescription', () => {
  it('leads with the instrument and city rather than an adjective', () => {
    const d = artistMetaDescription({
      name: 'Anirudh Athreya',
      instrument: 'kanjira',
      city: 'Chennai',
    });
    expect(d).toContain('Anirudh Athreya — Kanjira · Chennai.');
    expect(d).not.toMatch(/renowned|journey|contributions/);
  });

  it('names the lineage, which is the credential that counts here', () => {
    const d = artistMetaDescription({
      name: 'A',
      instrument: 'vocal',
      gurus: [{ name: 'Guru One', relationship: 'primary' }],
    });
    expect(d).toContain('Disciple of Guru One.');
  });

  it('treats an unclassified guru as lineage', () => {
    // Rows stored before the field existed are real relationships of unknown type.
    const d = artistMetaDescription({ name: 'A', gurus: [{ name: 'Guru One' }] });
    expect(d).toContain('Disciple of Guru One.');
  });

  it('never calls a workshop teacher a guru', () => {
    const d = artistMetaDescription({
      name: 'A',
      gurus: [{ name: 'Workshop Person', relationship: 'workshop' }],
    });
    expect(d).not.toContain('Workshop Person');
  });

  it('caps lineage at two names', () => {
    const d = artistMetaDescription({
      name: 'A',
      gurus: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }],
    });
    expect(d).toContain('Disciple of One and Two.');
    expect(d).not.toContain('Three');
  });

  it('says "trained under" for a group', () => {
    const d = artistMetaDescription({ name: 'A Group', isGroup: true, gurus: [{ name: 'G' }] });
    expect(d).toContain('Trained under G.');
  });

  it('mentions upcoming concerts, with singular agreement', () => {
    expect(artistMetaDescription({ name: 'A', upcomingEventCount: 1 })).toContain(
      '1 upcoming concert.'
    );
    expect(artistMetaDescription({ name: 'A', upcomingEventCount: 3 })).toContain(
      '3 upcoming concerts.'
    );
  });

  it('falls back to a specialisation when there is no instrument or city', () => {
    const d = artistMetaDescription({ name: 'A', specialisations: ['bharatanatyam'] });
    expect(d).toContain('A — Bharatanatyam.');
  });

  it('describes the page when nothing about the person is known', () => {
    const d = artistMetaDescription({ name: 'A' });
    expect(d).toBe(
      'A. Concerts, repertoire and recordings on Rasika.life, the Indian classical arts wiki.'
    );
  });
});
