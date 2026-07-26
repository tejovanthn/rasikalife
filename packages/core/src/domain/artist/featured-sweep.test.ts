import { describe, expect, it } from 'vitest';
import { buildFeaturedByArtist } from './featured-sweep';

const row = (
  over: Partial<{
    eventId: string;
    artistId: string;
    eventTitle: string;
    eventStartDateTime: string;
    role: string;
    isFeatured: boolean;
    featureRank: number;
  }>
) => ({
  eventId: 'e1',
  artistId: 'a1',
  eventTitle: 'Recital',
  eventStartDateTime: '2026-01-01T00:00:00.000Z',
  isFeatured: true,
  ...over,
});

describe('buildFeaturedByArtist', () => {
  it('keeps only featured, non-deleted rows and groups by artist', () => {
    const result = buildFeaturedByArtist(
      [
        row({ eventId: 'e1', artistId: 'a1', isFeatured: true }),
        row({ eventId: 'e2', artistId: 'a1', isFeatured: true }), // e2 soft-deleted
        row({ eventId: 'e3', artistId: 'a1', isFeatured: false }), // not featured
        row({ eventId: 'e4', artistId: 'a2', isFeatured: true }),
      ],
      new Set(['e2'])
    );

    // a1's e2 is excluded (deleted) and e3 excluded (not featured) → only e1 survives.
    expect(result.get('a1')?.map(f => f.eventId)).toEqual(['e1']);
    expect(result.get('a2')?.map(f => f.eventId)).toEqual(['e4']);
  });

  it('omits an artist whose every featured event is deleted (the sweep then clears them)', () => {
    const result = buildFeaturedByArtist(
      [row({ eventId: 'e1', artistId: 'a1', isFeatured: true })],
      new Set(['e1'])
    );
    expect(result.has('a1')).toBe(false);
  });

  it('stores each list pre-sorted by rank then most-recent', () => {
    const result = buildFeaturedByArtist(
      [
        row({ eventId: 'e1', eventStartDateTime: '2025-01-01T00:00:00.000Z', featureRank: 5 }),
        row({ eventId: 'e2', eventStartDateTime: '2026-06-01T00:00:00.000Z', featureRank: 2 }),
        row({ eventId: 'e3', eventStartDateTime: '2026-03-01T00:00:00.000Z' }), // unranked
      ],
      new Set()
    );
    // rank 2, rank 5, then unranked (most recent among unranked first).
    expect(result.get('a1')?.map(f => f.eventId)).toEqual(['e2', 'e1', 'e3']);
  });
});
