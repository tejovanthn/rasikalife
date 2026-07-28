import { describe, expect, it } from 'vitest';
import { artistTagline } from './artist-display';

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
