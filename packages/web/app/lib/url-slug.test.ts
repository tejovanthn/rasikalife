import { describe, expect, it } from 'vitest';
import {
  generateArtistUrl,
  generateCompositionUrl,
  generateEventUrl,
  generateFestivalUrl,
  generateLanguageUrl,
  generateOrganiserUrl,
  generateRagaUrl,
  generateSlug,
  generateTalaUrl,
  generateVenueUrl,
  parseSlug,
} from './url-slug';

const KSUID = 'abcdefghijklmnopqrstuvwxyz1'; // 27 alphanumeric chars

describe('generateSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(generateSlug('Vatapi Ganapatim')).toBe('vatapi-ganapatim');
  });

  it('collapses multiple spaces into single hyphens', () => {
    expect(generateSlug('Vatapi   Ganapatim')).toBe('vatapi-ganapatim');
  });

  it('URL-encodes characters that need escaping', () => {
    expect(generateSlug('R&B Fusion')).toBe('r%26b-fusion');
  });
});

describe('parseSlug', () => {
  it('parses a title-slug-id combination', () => {
    const result = parseSlug(`vatapi-ganapatim-${KSUID}`);

    expect(result).toEqual({ title: 'vatapi-ganapatim', id: KSUID });
  });

  it('parses an ID-only param (exactly 27 chars)', () => {
    const result = parseSlug(KSUID);

    expect(result).toEqual({ title: '', id: KSUID });
  });

  it('URL-decodes the param before parsing', () => {
    const result = parseSlug(`r%26b-fusion-${KSUID}`);

    expect(result).toEqual({ title: 'r&b-fusion', id: KSUID });
  });

  it('returns null for a param shorter than a bare KSUID', () => {
    expect(parseSlug('too-short')).toBeNull();
  });

  it('returns null when the 27-char segment is not alphanumeric', () => {
    const invalidId = '!'.repeat(27);
    expect(parseSlug(invalidId)).toBeNull();
  });

  it('returns null for invalid percent-encoding', () => {
    expect(parseSlug('%E0%A4%A')).toBeNull();
  });

  it('returns an empty title when the slug is just a hyphen plus the id', () => {
    const result = parseSlug(`-${KSUID}`);

    expect(result).toEqual({ title: '', id: KSUID });
  });
});

describe('generate*Url helpers', () => {
  it('builds a composition URL', () => {
    expect(generateCompositionUrl('Vatapi Ganapatim', 'comp-1')).toBe(
      '/carnatic/compositions/vatapi-ganapatim-comp-1'
    );
  });

  it('builds an artist URL', () => {
    expect(generateArtistUrl('Sanjay Subrahmanyan', 'artist-1')).toBe(
      '/artists/sanjay-subrahmanyan-artist-1'
    );
  });

  it('builds a raga URL', () => {
    expect(generateRagaUrl('Hamsadhwani', 'raga-1')).toBe('/carnatic/ragas/hamsadhwani-raga-1');
  });

  it('builds a tala URL', () => {
    expect(generateTalaUrl('Adi', 'tala-1')).toBe('/carnatic/talas/adi-tala-1');
  });

  it('builds a language URL without an id', () => {
    expect(generateLanguageUrl('Tamil')).toBe('/carnatic/languages/tamil');
  });

  it('builds an event URL', () => {
    expect(generateEventUrl('Margazhi Concert', 'event-1')).toBe(
      '/events/margazhi-concert-event-1'
    );
  });

  it('builds a festival URL', () => {
    expect(generateFestivalUrl('Margazhi Season', 'fest-1')).toBe(
      '/festivals/margazhi-season-fest-1'
    );
  });

  it('builds a venue URL', () => {
    expect(generateVenueUrl('Music Academy', 'venue-1')).toBe('/venues/music-academy-venue-1');
  });

  it('builds an organiser URL', () => {
    expect(generateOrganiserUrl('Madras Music Academy', 'org-1')).toBe(
      '/organisers/madras-music-academy-org-1'
    );
  });
});
