import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  ChangeHistoryEntity: {
    create: vi.fn(),
    query: {
      primary: vi.fn(),
      byUser: vi.fn(),
    },
  },
}));

import { ChangeHistoryEntity } from './entity';
import type { ChangeHistory } from './entity';
import {
  computeDiff,
  createChangeHistory,
  getChangeHistory,
  getChangeHistoryById,
  getEntityStateAtTimestamp,
  getUserChanges,
} from './service';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function makeChange(overrides: Partial<ChangeHistory> = {}): ChangeHistory {
  return {
    id: 'change-1',
    entityType: 'artist',
    entityId: 'artist-1',
    userId: 'user-1',
    action: 'update',
    diff: [{ field: 'name', oldValue: 'Old', newValue: 'New' }],
    timestamp: 1000,
    ...overrides,
  } as unknown as ChangeHistory;
}

describe('change-history/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createChangeHistory', () => {
    it('creates a change history entry with a generated id and timestamp', async () => {
      const created = makeChange();
      vi.mocked(ChangeHistoryEntity.create).mockReturnValue(goResolves(created) as never);

      const result = await createChangeHistory({
        entityType: 'artist',
        entityId: 'artist-1',
        userId: 'user-1',
        action: 'update',
        diff: [{ field: 'name', oldValue: 'Old', newValue: 'New' }],
      });

      expect(ChangeHistoryEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-id-123', entityType: 'artist', entityId: 'artist-1' })
      );
      expect(result).toEqual(created);
    });

    it('throws a database error when create returns no data', async () => {
      vi.mocked(ChangeHistoryEntity.create).mockReturnValue(goResolves(undefined) as never);

      await expect(
        createChangeHistory({
          entityType: 'artist',
          entityId: 'artist-1',
          userId: 'user-1',
          action: 'create',
          diff: [],
        })
      ).rejects.toThrow('Failed to create change history entry');
    });
  });

  describe('getChangeHistory', () => {
    it('queries by entityType/entityId with a default limit of 50, descending order', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [makeChange()], cursor: undefined });
      vi.mocked(ChangeHistoryEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getChangeHistory('artist', 'artist-1');

      expect(ChangeHistoryEntity.query.primary).toHaveBeenCalledWith({
        entityType: 'artist',
        entityId: 'artist-1',
      });
      expect(goSpy).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, order: 'desc', cursor: undefined })
      );
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('propagates pagination params and reports hasMore/nextToken from the cursor', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [], cursor: 'next-page' });
      vi.mocked(ChangeHistoryEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getChangeHistory('artist', 'artist-1', {
        limit: 10,
        nextToken: 'prev-page',
      });

      expect(goSpy).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, cursor: 'prev-page' })
      );
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBe('next-page');
    });
  });

  describe('getChangeHistoryById', () => {
    it('always returns null regardless of arguments (unimplemented stub)', async () => {
      expect(await getChangeHistoryById('artist', 'artist-1', 'change-1')).toBeNull();
    });
  });

  describe('getUserChanges', () => {
    it('queries byUser with a default limit of 50, descending order', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [makeChange()], cursor: undefined });
      vi.mocked(ChangeHistoryEntity.query.byUser).mockReturnValue({ go: goSpy } as never);

      const result = await getUserChanges('user-1');

      expect(ChangeHistoryEntity.query.byUser).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, order: 'desc' }));
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getEntityStateAtTimestamp', () => {
    it('returns null when there are no changes at or before the target timestamp', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [makeChange({ timestamp: 2000 })] });
      vi.mocked(ChangeHistoryEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getEntityStateAtTimestamp('artist', 'artist-1', 1000);

      expect(result).toBeNull();
    });

    it('reconstructs prior state from an update using diff oldValue', async () => {
      const change = makeChange({
        action: 'update',
        timestamp: 1000,
        diff: [{ field: 'name', oldValue: 'Old Name', newValue: 'New Name' }],
      });
      const goSpy = vi.fn().mockResolvedValue({ data: [change] });
      vi.mocked(ChangeHistoryEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getEntityStateAtTimestamp('artist', 'artist-1', 1500);

      expect(result?.change).toEqual(change);
      expect(result?.stateBefore).toEqual({ name: 'Old Name' });
    });

    it('reconstructs prior state from a create using diff newValue', async () => {
      const change = makeChange({
        action: 'create',
        timestamp: 1000,
        diff: [{ field: 'name', oldValue: undefined, newValue: 'First Name' }],
      });
      const goSpy = vi.fn().mockResolvedValue({ data: [change] });
      vi.mocked(ChangeHistoryEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getEntityStateAtTimestamp('artist', 'artist-1', 1500);

      expect(result?.stateBefore).toEqual({ name: 'First Name' });
    });

    it('ignores changes after the target timestamp, but "change" is the OLDEST relevant one, not the latest', async () => {
      // getEntityStateAtTimestamp queries with order: 'desc', so `result.data` arrives
      // newest-first. It filters to changes <= targetTimestamp, then takes
      // relevantChanges[relevantChanges.length - 1] as `change` — since the filtered
      // array is still newest-first, that "last" element is actually the OLDEST
      // relevant change, not the most recent one before the target timestamp. This
      // looks like an off-by-reversal bug rather than intended behavior; this test
      // pins down the current (surprising) behavior.
      const early = makeChange({
        action: 'create',
        timestamp: 1000,
        diff: [{ field: 'name', oldValue: undefined, newValue: 'First' }],
      });
      const relevant = makeChange({
        action: 'update',
        timestamp: 1500,
        diff: [{ field: 'name', oldValue: 'First', newValue: 'Second' }],
      });
      const future = makeChange({
        action: 'update',
        timestamp: 3000,
        diff: [{ field: 'name', oldValue: 'Second', newValue: 'Third' }],
      });
      const goSpy = vi.fn().mockResolvedValue({ data: [future, relevant, early] });
      vi.mocked(ChangeHistoryEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getEntityStateAtTimestamp('artist', 'artist-1', 2000);

      expect(result?.change).toEqual(early);
      // stateBefore still folds over ALL relevant changes regardless of which one
      // is reported as `change`, so it reflects the pre-`relevant`-change value.
      expect(result?.stateBefore).toEqual({ name: 'First' });
    });
  });

  describe('computeDiff', () => {
    it('returns an empty diff when nothing changed', async () => {
      expect(await computeDiff({ name: 'Alice' }, { name: 'Alice' })).toEqual([]);
    });

    it('reports changed fields with old and new values', async () => {
      const diff = await computeDiff({ name: 'Alice', age: 30 }, { name: 'Bob', age: 30 });

      expect(diff).toEqual([{ field: 'name', oldValue: 'Alice', newValue: 'Bob' }]);
    });

    it('treats before=null as an all-undefined baseline', async () => {
      const diff = await computeDiff(null, { name: 'Alice' });

      expect(diff).toEqual([{ field: 'name', oldValue: undefined, newValue: 'Alice' }]);
    });

    it('includes fields present in before but removed from after', async () => {
      const diff = await computeDiff({ name: 'Alice', nickname: 'Al' }, { name: 'Alice' });

      expect(diff).toEqual([{ field: 'nickname', oldValue: 'Al', newValue: undefined }]);
    });
  });
});
