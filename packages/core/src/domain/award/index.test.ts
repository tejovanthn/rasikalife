import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'award-test-id'),
}));

vi.mock('./entity', () => ({
  AwardEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    query: { byName: vi.fn(), list: vi.fn() },
  },
}));

import {
  CreateAwardSchema,
  createAward,
  getAward,
  getAwardByName,
  listAwards,
  listAwardsByOrganiser,
  mergeAward,
  softDeleteAward,
  updateAward,
} from '.';
import { AwardEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function makeListChain(data: unknown) {
  const chain = {
    where: vi.fn(() => chain),
    go: vi.fn().mockResolvedValue({ data }),
  };
  return chain;
}

const baseAward = { id: 'award-1', name: 'Sangita Kalanidhi' };

describe('award', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAward', () => {
    it('creates an award with a generated id', async () => {
      vi.mocked(AwardEntity.create).mockReturnValue(goResolves(baseAward) as never);

      const result = await createAward({ name: 'Sangita Kalanidhi' });

      expect(AwardEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'award-test-id', name: 'Sangita Kalanidhi' })
      );
      expect(result).toEqual(baseAward);
    });

    it('throws a create-failed error when the entity returns no data', async () => {
      vi.mocked(AwardEntity.create).mockReturnValue(goResolves(undefined) as never);

      await expect(createAward({ name: 'Broken Award' })).rejects.toThrow(
        'Failed to create award: Broken Award'
      );
    });
  });

  describe('getAward', () => {
    it('returns the award when found and not deleted', async () => {
      vi.mocked(AwardEntity.get).mockReturnValue(goResolves(baseAward) as never);

      expect(await getAward('award-1')).toEqual(baseAward);
    });

    it('returns null when not found', async () => {
      vi.mocked(AwardEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getAward('missing')).toBeNull();
    });

    it('returns null for a soft-deleted award that was not merged', async () => {
      vi.mocked(AwardEntity.get).mockReturnValue(
        goResolves({ ...baseAward, deletedAt: '2026-01-01T00:00:00.000Z' }) as never
      );

      expect(await getAward('award-1')).toBeNull();
    });

    it('still returns a soft-deleted award if it was merged into another', async () => {
      const merged = {
        ...baseAward,
        deletedAt: '2026-01-01T00:00:00.000Z',
        mergedIntoId: 'award-2',
      };
      vi.mocked(AwardEntity.get).mockReturnValue(goResolves(merged) as never);

      expect(await getAward('award-1')).toEqual(merged);
    });
  });

  describe('getAwardByName', () => {
    it('returns the first matching award', async () => {
      vi.mocked(AwardEntity.query.byName).mockReturnValue(goResolves([baseAward]) as never);

      expect(await getAwardByName('Sangita Kalanidhi')).toEqual(baseAward);
    });

    it('returns null when there is no match', async () => {
      vi.mocked(AwardEntity.query.byName).mockReturnValue(goResolves([]) as never);

      expect(await getAwardByName('Unknown')).toBeNull();
    });
  });

  describe('updateAward', () => {
    it('updates and returns the new award data', async () => {
      const setResult = { ...baseAward, description: 'Updated' };
      vi.mocked(AwardEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue(goResolves(setResult)),
      } as never);

      const result = await updateAward('award-1', { description: 'Updated' });

      expect(result).toEqual(setResult);
    });

    it('throws a not-found error when the update returns no data', async () => {
      vi.mocked(AwardEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue(goResolves(undefined)),
      } as never);

      await expect(updateAward('missing', {})).rejects.toThrow('award with ID missing not found');
    });
  });

  describe('softDeleteAward', () => {
    it('sets deletedAt on the award', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(AwardEntity.update).mockReturnValue({ set: setSpy } as never);

      await softDeleteAward('award-1');

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(String) })
      );
    });
  });

  describe('listAwards', () => {
    it('filters out soft-deleted awards and sorts by rank', async () => {
      vi.mocked(AwardEntity.query.list).mockReturnValue(
        makeListChain([
          { ...baseAward, id: 'a2', rank: undefined },
          { ...baseAward, id: 'a1', rank: 1 },
        ]) as never
      );

      const result = await listAwards();

      expect(result.map(a => a.id)).toEqual(['a1', 'a2']);
    });
  });

  describe('listAwardsByOrganiser', () => {
    it('filters by issuingOrganisationId and excludes soft-deleted awards', async () => {
      const chain = makeListChain([baseAward]);
      vi.mocked(AwardEntity.query.list).mockReturnValue(chain as never);

      const result = await listAwardsByOrganiser('org-1');

      expect(chain.where).toHaveBeenCalledTimes(2);
      expect(result).toEqual([baseAward]);
    });
  });

  describe('mergeAward', () => {
    it('soft-deletes the loser and points it at the canonical award', async () => {
      vi.mocked(AwardEntity.get)
        .mockReturnValueOnce(goResolves(baseAward) as never) // canonical
        .mockReturnValueOnce(goResolves({ id: 'award-2' }) as never); // loser
      const setSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(AwardEntity.update).mockReturnValue({ set: setSpy } as never);

      await mergeAward('award-2', 'award-1');

      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ mergedIntoId: 'award-1' }));
    });

    it('throws when the canonical award does not exist', async () => {
      vi.mocked(AwardEntity.get).mockReturnValue(goResolves(undefined) as never);

      await expect(mergeAward('award-2', 'missing')).rejects.toThrow(
        'award with ID missing not found'
      );
    });

    it('throws when the loser award does not exist', async () => {
      vi.mocked(AwardEntity.get)
        .mockReturnValueOnce(goResolves(baseAward) as never)
        .mockReturnValueOnce(goResolves(undefined) as never);

      await expect(mergeAward('missing-loser', 'award-1')).rejects.toThrow(
        'award with ID missing-loser not found'
      );
    });
  });

  describe('CreateAwardSchema', () => {
    it('accepts minimal valid input', () => {
      expect(() => CreateAwardSchema.parse({ name: 'Sangita Kalanidhi' })).not.toThrow();
    });

    it('rejects an invalid category', () => {
      expect(() =>
        CreateAwardSchema.parse({ name: 'Award', category: 'not-a-real-category' })
      ).toThrow();
    });
  });
});
