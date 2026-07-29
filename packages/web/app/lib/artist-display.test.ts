import { describe, expect, it } from 'vitest';
import { artistTagline, parseInstruments } from './artist-display';

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
