import { describe, expect, it } from 'vitest';
import { CreateArtistSchema, UpdateArtistSchema } from './schema';

describe('CreateArtistSchema', () => {
  describe('gurus', () => {
    // The widened element is a superset of the old {id, name} shape, which is
    // why the reshape needs no data backfill. If this test ever fails, every
    // stored guru row has become invalid.
    it('accepts the old {id, name} shape unchanged', () => {
      const result = CreateArtistSchema.safeParse({
        name: 'T M Krishna',
        gurus: [{ id: 'artist-1', name: 'Semmangudi Srinivasa Iyer' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts the widened shape with years and discipline', () => {
      const result = CreateArtistSchema.safeParse({
        name: 'T M Krishna',
        gurus: [
          {
            id: 'artist-1',
            name: 'Semmangudi Srinivasa Iyer',
            fromYear: 1990,
            toYear: 1998,
            discipline: 'vocal',
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data?.gurus[0]).toMatchObject({ fromYear: 1990, discipline: 'vocal' });
    });

    it('still requires a guru name', () => {
      const result = CreateArtistSchema.safeParse({ name: 'X', gurus: [{ fromYear: 1990 }] });
      expect(result.success).toBe(false);
    });

    it('defaults to an empty list', () => {
      const result = CreateArtistSchema.parse({ name: 'X' });
      expect(result.gurus).toEqual([]);
    });
  });

  it('accepts the new profile fields', () => {
    const result = CreateArtistSchema.safeParse({
      name: 'Ganesh Kumaresh',
      instrument: 'violin',
      city: 'Chennai',
      practiceStartYear: 1975,
      debutYear: 1982,
      photoUrl: 'https://cdn.example.com/a.jpg',
      photoUploadId: 'upload-1',
      isGroup: true,
    });
    expect(result.success).toBe(true);
  });

  // These are set by the artist-claim flow. Leaving them out of the schema is
  // what stops an editor — or a bulk CSV import — awarding a verified badge.
  it('strips claimStatus and verifiedAt rather than accepting them', () => {
    const result = CreateArtistSchema.parse({
      name: 'X',
      claimStatus: 'verified',
      verifiedAt: '2026-07-22T00:00:00.000Z',
    } as never);
    expect(result).not.toHaveProperty('claimStatus');
    expect(result).not.toHaveProperty('verifiedAt');
  });

  it('rejects a non-URL photoUrl', () => {
    expect(CreateArtistSchema.safeParse({ name: 'X', photoUrl: 'not-a-url' }).success).toBe(false);
  });
});

describe('UpdateArtistSchema', () => {
  it('makes every field optional', () => {
    expect(UpdateArtistSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial update of a new field', () => {
    const result = UpdateArtistSchema.safeParse({ city: 'Bengaluru' });
    expect(result.success).toBe(true);
  });
});
