import { describe, expect, it } from 'vitest';
import { legacyConcertsRedirect, resolveEventsSegment } from './events-route';
import { generateEventUrl } from './url-slug';

const KSUID = '3L7jpdTnD2Grxr4HS8ycF7wCgsz';

describe('resolveEventsSegment', () => {
  it('reads anything ending in a 27-character id as an event', () => {
    expect(resolveEventsSegment(KSUID)).toBe('event');
    expect(resolveEventsSegment(`ashtanayika-${KSUID}`)).toBe('event');
    expect(resolveEventsSegment(generateEventUrl('Veena Recital: Rāga', KSUID).slice(8))).toBe(
      'event'
    );
  });

  it('reads a city slug as a city, including the long ones', () => {
    for (const slug of ['chennai', 'bengaluru', 'thiruvananthapuram', 'bangalore', 'new-delhi']) {
      expect(resolveEventsSegment(slug)).toBe('city');
    }
  });

  it('never lets a city slug shadow an event: the id test wins', () => {
    // A city slug this long ending in 27 id characters would be an event, not a city.
    expect(resolveEventsSegment(`some-city-${KSUID}`)).toBe('event');
  });

  it('leaves junk to the listing, which answers 404', () => {
    expect(resolveEventsSegment('%E0%A4%A')).toBe('city');
    expect(resolveEventsSegment('x-short')).toBe('city');
  });
});

describe('legacyConcertsRedirect', () => {
  it('moves /<city>/concerts to /events/<city>', () => {
    expect(legacyConcertsRedirect('bengaluru', '')).toBe('/events/bengaluru');
  });

  it('keeps the query string', () => {
    expect(legacyConcertsRedirect('chennai', '?when=2026-12&free=1')).toBe(
      '/events/chennai?when=2026-12&free=1'
    );
  });

  it('folds an old city name in the same hop', () => {
    expect(legacyConcertsRedirect('bangalore', '?when=weekend')).toBe(
      '/events/bengaluru?when=weekend'
    );
  });
});
