import { describe, expect, it } from 'vitest';
import { venueLine } from './venue-line';

describe('venueLine', () => {
  it('adds the city after the venue', () => {
    expect(venueLine('Narada Gana Sabha', 'Chennai')).toBe('Narada Gana Sabha, Chennai');
  });

  it('prints the venue alone when the city is unknown', () => {
    expect(venueLine('Narada Gana Sabha')).toBe('Narada Gana Sabha');
    expect(venueLine('Narada Gana Sabha', '  ')).toBe('Narada Gana Sabha');
    expect(venueLine('Narada Gana Sabha', null)).toBe('Narada Gana Sabha');
  });

  it('does not repeat a city the venue name holds', () => {
    expect(venueLine('Chennai Music Hall', 'Chennai')).toBe('Chennai Music Hall');
  });
});
