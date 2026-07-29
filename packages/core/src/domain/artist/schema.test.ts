import { describe, expect, it } from 'vitest';
import {
  CLAIMANT_EDITABLE_ARTIST_FIELDS,
  CreateArtistSchema,
  UpdateArtistSchema,
  isClaimantEditablePatch,
} from './schema';

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
    });
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

// This set decides what a verified claim self-approves without a moderator (§4.3.1). Each
// exclusion is a capability the claim was never described as granting, so they get named
// tests rather than being left to the reader of the array.
describe('isClaimantEditablePatch', () => {
  it('accepts the descriptive fields an artist owns about themselves', () => {
    expect(
      isClaimantEditablePatch({
        biography: 'Learned under...',
        city: 'Chennai',
        instrument: 'vocal',
        socialLinks: [],
        gurus: [],
      })
    ).toBe(true);
  });

  it('accepts an empty patch', () => {
    expect(isClaimantEditablePatch({})).toBe(true);
  });

  it('refuses a rename, which cascades onto other artists rows', () => {
    expect(isClaimantEditablePatch({ name: 'A New Name' })).toBe(false);
    expect(isClaimantEditablePatch({ biography: 'fine', name: 'A New Name' })).toBe(false);
  });

  it('refuses isGroup, the field artist.update is moderator-only to protect', () => {
    expect(isClaimantEditablePatch({ isGroup: true })).toBe(false);
  });

  it('refuses photoUrl, which the OG lambda fetches server-side', () => {
    expect(isClaimantEditablePatch({ photoUrl: 'https://example.com/x.jpg' })).toBe(false);
    expect(isClaimantEditablePatch({ photoUploadId: 'abc' })).toBe(false);
  });

  it('refuses a field nobody has considered, rather than letting it through', () => {
    expect(isClaimantEditablePatch({ claimStatus: 'verified' })).toBe(false);
    expect(isClaimantEditablePatch({ somethingAddedLater: 1 })).toBe(false);
  });

  it('lists only fields the update schema actually has', () => {
    // A typo here would silently narrow the grant rather than fail, so pin the names
    // against the schema itself.
    const updatable = Object.keys(UpdateArtistSchema.shape);
    for (const field of CLAIMANT_EDITABLE_ARTIST_FIELDS) {
      expect(updatable).toContain(field);
    }
  });
});
