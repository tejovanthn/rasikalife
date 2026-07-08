import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ArtistAwardEntity: {
    create: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byAward: vi.fn() },
  },
}));

import {
  AddArtistAwardSchema,
  addArtistAward,
  getArtistAwards,
  getAwardRecipients,
  removeArtistAward,
} from '.';
import { ArtistAwardEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const validInput = {
  artistId: 'artist-1',
  artistName: 'Sanjay Subrahmanyan',
  awardId: 'award-1',
  awardName: 'Sangita Kalanidhi',
};

describe('artist-award', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addArtistAward', () => {
    it('creates the artist-award link', async () => {
      vi.mocked(ArtistAwardEntity.create).mockReturnValue(goResolves(validInput) as never);

      const result = await addArtistAward(validInput);

      expect(ArtistAwardEntity.create).toHaveBeenCalledWith(validInput);
      expect(result).toEqual(validInput);
    });
  });

  describe('removeArtistAward', () => {
    it('deletes the artist-award link by composite key', async () => {
      vi.mocked(ArtistAwardEntity.delete).mockReturnValue(goResolves(undefined) as never);

      await removeArtistAward('artist-1', 'award-1');

      expect(ArtistAwardEntity.delete).toHaveBeenCalledWith({
        artistId: 'artist-1',
        awardId: 'award-1',
      });
    });
  });

  describe('getArtistAwards', () => {
    it('sorts by rank ascending, treating missing rank as last', async () => {
      vi.mocked(ArtistAwardEntity.query.primary).mockReturnValue(
        goResolves([
          { ...validInput, awardId: 'a2', rank: undefined },
          { ...validInput, awardId: 'a1', rank: 2 },
          { ...validInput, awardId: 'a3', rank: 1 },
        ]) as never
      );

      const result = await getArtistAwards('artist-1');

      expect(result.map(a => a.awardId)).toEqual(['a3', 'a1', 'a2']);
    });

    it('returns an empty array when there is no data', async () => {
      vi.mocked(ArtistAwardEntity.query.primary).mockReturnValue(goResolves(undefined) as never);

      expect(await getArtistAwards('artist-1')).toEqual([]);
    });
  });

  describe('getAwardRecipients', () => {
    it('sorts by year ascending, treating missing year as 0 (first)', async () => {
      vi.mocked(ArtistAwardEntity.query.byAward).mockReturnValue(
        goResolves([
          { ...validInput, artistId: 'p2', year: 2020 },
          { ...validInput, artistId: 'p1', year: undefined },
          { ...validInput, artistId: 'p3', year: 2010 },
        ]) as never
      );

      const result = await getAwardRecipients('award-1');

      expect(result.map(a => a.artistId)).toEqual(['p1', 'p3', 'p2']);
    });
  });

  describe('AddArtistAwardSchema', () => {
    it('accepts valid input', () => {
      expect(() => AddArtistAwardSchema.parse(validInput)).not.toThrow();
    });

    it('rejects a year outside the valid range', () => {
      expect(() => AddArtistAwardSchema.parse({ ...validInput, year: 1800 })).toThrow();
    });

    it('rejects a missing required field', () => {
      const { artistId, ...rest } = validInput;
      expect(() => AddArtistAwardSchema.parse(rest)).toThrow();
    });
  });
});
