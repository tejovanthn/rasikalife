import { describe, expect, it } from 'vitest';
import { computeCompletionScore, missingFields } from './completion';
import type { CompletionEntityType } from './completion';

// Each entity type's rule weights are designed to sum to exactly 100.
const FULLY_COMPLETE_ENTITIES: Record<CompletionEntityType, Record<string, unknown>> = {
  artist: {
    biography: 'A long biography',
    specialisations: ['Carnatic vocal'],
    gurus: ['Guru A'],
    works: [{ title: 'Matrutvam' }],
    birthYear: 1950,
    birthPlace: 'Chennai',
    title: 'Sangeetha Kalanidhi',
    website: 'https://example.com',
    socialLinks: [{ platform: 'youtube', url: 'https://youtube.com/x' }],
  },
  raga: {
    description: 'A raga description',
    tradition: 'Carnatic',
    arohanam: 'S R G M P D N S',
    avarohanam: 'S N D P M G R S',
    rasa: 'Bhakti',
    timeOfDay: 'Morning',
    melaNumber: 29,
    parentRaga: 'Some Raga',
  },
  tala: {
    description: 'A tala description',
    tradition: 'Carnatic',
    aksharas: 8,
    angaStructure: ['laghu', 'drutam'],
  },
  composition: {
    lyricsV1: [{ text: 'line' }],
    ragas: [{ id: 'r1' }],
    talas: [{ id: 't1' }],
    sourceAttribution: 'Traditional',
  },
  venue: {
    description: 'A venue description',
    venueType: 'Auditorium',
    address: { city: 'Chennai' },
    website: 'https://example.com',
    capacity: 500,
    phone: '1234567890',
    email: 'venue@example.com',
    mapLink: 'https://maps.example.com',
  },
  organiser: {
    description: 'An organiser description',
    organisationType: 'Sabha',
    website: 'https://example.com',
    socialLinks: [{ platform: 'youtube', url: 'https://youtube.com/x' }],
    city: 'Chennai',
    email: 'org@example.com',
    foundedYear: 1950,
    phone: '1234567890',
  },
  festival: {
    description: 'A festival description',
    posterUrl: 'https://example.com/poster.png',
    organiserId: 'org-1',
    tags: ['carnatic'],
    sponsors: ['Sponsor A'],
  },
};

describe('computeCompletionScore', () => {
  it.each(Object.keys(FULLY_COMPLETE_ENTITIES) as CompletionEntityType[])(
    'scores an empty %s entity as 0',
    type => {
      expect(computeCompletionScore({}, type)).toBe(0);
    }
  );

  it.each(
    Object.entries(FULLY_COMPLETE_ENTITIES) as Array<
      [CompletionEntityType, Record<string, unknown>]
    >
  )('scores a fully-enriched %s entity as 100', (type, entity) => {
    expect(computeCompletionScore(entity, type)).toBe(100);
  });

  it('gives partial credit for partially-filled artist fields', () => {
    const score = computeCompletionScore({ biography: 'Some bio' }, 'artist');

    expect(score).toBe(20);
  });

  // Affiliations live in the ArtistAffiliation junction, and the enrichment queue scores
  // artists straight off artist.list without loading it. A rule for them here would score
  // every artist in that pool as missing one and flatten the ranking.
  it('scores only fields stored on the artist record', () => {
    const withJunctionData = computeCompletionScore(
      { ...FULLY_COMPLETE_ENTITIES.artist, affiliations: [{ organisationName: 'X' }] },
      'artist'
    );

    expect(withJunctionData).toBe(100);
  });

  it('treats an empty string as not filled in', () => {
    expect(computeCompletionScore({ description: '' }, 'tala')).toBe(0);
  });

  it('treats an empty array as not filled in', () => {
    expect(computeCompletionScore({ tags: [] }, 'festival')).toBe(0);
  });

  it('treats a non-string value in a string field as not filled in', () => {
    expect(computeCompletionScore({ biography: 123 }, 'artist')).toBe(0);
  });

  it('treats a non-array value in an array field as not filled in', () => {
    expect(computeCompletionScore({ specialisations: 'not an array' }, 'artist')).toBe(0);
  });

  it('handles a nested address field for venue completeness', () => {
    const withCity = computeCompletionScore({ address: { city: 'Chennai' } }, 'venue');
    const withoutAddress = computeCompletionScore({}, 'venue');

    expect(withCity).toBe(15);
    expect(withoutAddress).toBe(0);
  });

  it('credits festival organiser info from either organiserId or organiserName', () => {
    const withId = computeCompletionScore({ organiserId: 'org-1' }, 'festival');
    const withName = computeCompletionScore({ organiserName: 'Some Sabha' }, 'festival');

    expect(withId).toBe(20);
    expect(withName).toBe(20);
  });
});

describe('missingFields', () => {
  it.each(Object.keys(FULLY_COMPLETE_ENTITIES) as CompletionEntityType[])(
    'returns nothing for a fully-enriched %s',
    type => {
      expect(missingFields(FULLY_COMPLETE_ENTITIES[type], type)).toEqual([]);
    }
  );

  it('names every gap on an empty artist', () => {
    expect(missingFields({}, 'artist')).toEqual([
      'a short biography',
      'gurus and lineage',
      'specialisations',
      'productions and works',
      'a title',
      'a birth year',
      'a birth place',
      'a website',
      'social links',
    ]);
  });

  // The first entry is what a claim prompt asks for, so it has to be the heaviest gap
  // rather than whichever rule happens to be declared first.
  it('orders gaps heaviest first', () => {
    const gaps = missingFields({ biography: 'Some bio' }, 'artist');

    expect(gaps[0]).toBe('gurus and lineage');
    expect(gaps).not.toContain('a short biography');
  });

  it('omits a field that is filled in', () => {
    const gaps = missingFields({ gurus: [{ name: 'Radha Shridhar' }] }, 'artist');

    expect(gaps).not.toContain('gurus and lineage');
  });

  it('treats an empty array as a gap, matching the score', () => {
    expect(missingFields({ gurus: [] }, 'artist')).toContain('gurus and lineage');
  });
});
