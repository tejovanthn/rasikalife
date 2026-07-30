import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ArtistAffiliationEntity: {
    put: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byOrganiser: vi.fn() },
  },
}));

import {
  AddArtistAffiliationSchema,
  addArtistAffiliation,
  getArtistAffiliations,
  getOrganiserArtists,
  removeArtistAffiliation,
} from '.';
import { ArtistAffiliationEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const validInput = {
  artistId: 'artist-1',
  artistName: 'Yagnika Madhusudan Iyengar',
  organiserId: 'organiser-1',
  organisationName: 'Trayag Natyalaya',
};

describe('artist-affiliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addArtistAffiliation', () => {
    // put, not upsert. upsert builds an UpdateExpression and ElectroDB drops undefined values
    // out of one entirely, so clearing a wrong role silently restored the old one — and
    // `response: 'all_new'` echoed the stale value back into the form.
    it('puts, so re-adding a pair replaces the row rather than merging into it', async () => {
      vi.mocked(ArtistAffiliationEntity.put).mockReturnValue(goResolves(validInput) as never);

      const result = await addArtistAffiliation(validInput);

      expect(ArtistAffiliationEntity.put).toHaveBeenCalledWith(validInput);
      expect(result).toEqual(validInput);
    });

    it('clears an optional the caller omitted', async () => {
      vi.mocked(ArtistAffiliationEntity.put).mockReturnValue(goResolves(validInput) as never);

      await addArtistAffiliation({ ...validInput, role: undefined });

      // The whole row is written, so an absent role is an absent attribute — not a merge that
      // leaves the previous one standing.
      expect(ArtistAffiliationEntity.put).toHaveBeenCalledWith(
        expect.objectContaining({ role: undefined })
      );
    });
  });

  describe('removeArtistAffiliation', () => {
    it('deletes by the artist/organiser pair', async () => {
      vi.mocked(ArtistAffiliationEntity.delete).mockReturnValue(goResolves(undefined) as never);

      await removeArtistAffiliation('artist-1', 'organiser-1');

      expect(ArtistAffiliationEntity.delete).toHaveBeenCalledWith({
        artistId: 'artist-1',
        organiserId: 'organiser-1',
      });
    });
  });

  describe('getArtistAffiliations', () => {
    it('puts current roles first, then most recent start year', async () => {
      vi.mocked(ArtistAffiliationEntity.query.primary).mockReturnValue(
        goResolves([
          { ...validInput, organiserId: 'past-2005', startYear: 2005, isCurrent: false },
          { ...validInput, organiserId: 'current-2017', startYear: 2017, isCurrent: true },
          { ...validInput, organiserId: 'past-2015', startYear: 2015, isCurrent: false },
          { ...validInput, organiserId: 'current-2020', startYear: 2020, isCurrent: true },
        ]) as never
      );

      const result = await getArtistAffiliations('artist-1');

      expect(result.map(a => a.organiserId)).toEqual([
        'current-2020',
        'current-2017',
        'past-2015',
        'past-2005',
      ]);
    });

    it('sorts an undated row last within its group, not first', async () => {
      vi.mocked(ArtistAffiliationEntity.query.primary).mockReturnValue(
        goResolves([
          { ...validInput, organiserId: 'undated' },
          { ...validInput, organiserId: 'dated', startYear: 1998 },
        ]) as never
      );

      const result = await getArtistAffiliations('artist-1');

      expect(result.map(a => a.organiserId)).toEqual(['dated', 'undated']);
    });

    it('falls back to organisation name when recency ties', async () => {
      vi.mocked(ArtistAffiliationEntity.query.primary).mockReturnValue(
        goResolves([
          { ...validInput, organiserId: 'o2', organisationName: 'Christ University' },
          { ...validInput, organiserId: 'o1', organisationName: 'Attakkalari Institute' },
        ]) as never
      );

      const result = await getArtistAffiliations('artist-1');

      expect(result.map(a => a.organisationName)).toEqual([
        'Attakkalari Institute',
        'Christ University',
      ]);
    });

    it('returns an empty array when there is no data', async () => {
      vi.mocked(ArtistAffiliationEntity.query.primary).mockReturnValue(
        goResolves(undefined) as never
      );

      expect(await getArtistAffiliations('artist-1')).toEqual([]);
    });
  });

  describe('getOrganiserArtists', () => {
    it('reads the reverse index and ties on artist name', async () => {
      vi.mocked(ArtistAffiliationEntity.query.byOrganiser).mockReturnValue(
        goResolves([
          { ...validInput, artistId: 'a2', artistName: 'Radha Shridhar' },
          { ...validInput, artistId: 'a1', artistName: 'Padmini Ravi' },
        ]) as never
      );

      const result = await getOrganiserArtists('organiser-1');

      expect(ArtistAffiliationEntity.query.byOrganiser).toHaveBeenCalledWith({
        organiserId: 'organiser-1',
      });
      expect(result.map(a => a.artistName)).toEqual(['Padmini Ravi', 'Radha Shridhar']);
    });
  });

  describe('AddArtistAffiliationSchema', () => {
    it('accepts valid input', () => {
      expect(() => AddArtistAffiliationSchema.parse(validInput)).not.toThrow();
    });

    it('accepts the full shape an extraction review produces', () => {
      expect(() =>
        AddArtistAffiliationSchema.parse({
          ...validInput,
          role: 'founder, artistic director',
          discipline: 'Bharatanatyam',
          startYear: 2017,
          isCurrent: true,
          source: 'bio-extraction',
        })
      ).not.toThrow();
    });

    // The index is not sparse over an optional key — a blank organiserId would write one hot
    // partition and match everything on lookup, so the schema has to hold this line.
    it('rejects a blank organiserId', () => {
      expect(() => AddArtistAffiliationSchema.parse({ ...validInput, organiserId: '' })).toThrow();
    });

    it('rejects a missing organiserId outright', () => {
      const { organiserId, ...rest } = validInput;
      expect(() => AddArtistAffiliationSchema.parse(rest)).toThrow();
    });

    it('rejects an unknown source', () => {
      expect(() =>
        AddArtistAffiliationSchema.parse({ ...validInput, source: 'hearsay' })
      ).toThrow();
    });

    // The importer reads isCurrent from one CSV column and endYear from another, so it can
    // produce the pair. The result renders as "1998–2015" while sorting to the top of the
    // organisation's faculty list as current.
    it('rejects a row that is both ended and current', () => {
      expect(() =>
        AddArtistAffiliationSchema.parse({ ...validInput, endYear: 2015, isCurrent: true })
      ).toThrow();
    });

    it('still accepts an ended row, and a current row with no end year', () => {
      expect(() =>
        AddArtistAffiliationSchema.parse({ ...validInput, endYear: 2015, isCurrent: false })
      ).not.toThrow();
      expect(() =>
        AddArtistAffiliationSchema.parse({ ...validInput, startYear: 2017, isCurrent: true })
      ).not.toThrow();
    });

    it('rejects a year outside the valid range', () => {
      expect(() => AddArtistAffiliationSchema.parse({ ...validInput, startYear: 1799 })).toThrow();
      expect(() => AddArtistAffiliationSchema.parse({ ...validInput, endYear: 2101 })).toThrow();
    });
  });
});
