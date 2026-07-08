import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', () => ({
  ConcertLogItemEntity: {
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    query: {
      primary: vi.fn(),
      byEvent: vi.fn(),
      byComposition: vi.fn(),
      byRaga: vi.fn(),
      byPendingModeration: vi.fn(),
    },
  },
  COMPOSITION_TYPES: ['kriti', 'varnam'],
}));

import {
  deleteAllUserSetlistItems,
  deleteSetlistItem,
  linkFreeTextToComposition,
  listEventSetlistItems,
  listPendingFreeTextItems,
  listPerformancesByComposition,
  listPerformancesByRaga,
  listUserSetlist,
  rejectFreeTextItem,
  replaceUserSetlist,
  upsertSetlistItem,
} from '.';
import { dynamoClient } from '../../db/client';
import { ConcertLogItemEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    compositionTitle: 'Vatapi Ganapatim',
    eventStartDateTime: '2026-01-01T18:00:00.000Z',
    ...overrides,
  };
}

describe('concert-log-item', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertSetlistItem', () => {
    it('puts an item and defaults isHighlight to false when not provided', async () => {
      const putSpy = vi
        .fn()
        .mockReturnValue(goResolves({ userId: 'u1', eventId: 'e1', order: 0, isHighlight: false }));
      vi.mocked(ConcertLogItemEntity.put).mockImplementation(putSpy as never);

      const result = await upsertSetlistItem('u1', 'e1', 0, baseInput());

      expect(putSpy).toHaveBeenCalledWith(expect.objectContaining({ isHighlight: false }));
      expect(result.isHighlight).toBe(false);
    });

    it('respects an explicit isHighlight value', async () => {
      const putSpy = vi.fn().mockReturnValue(goResolves({}));
      vi.mocked(ConcertLogItemEntity.put).mockImplementation(putSpy as never);

      await upsertSetlistItem('u1', 'e1', 0, baseInput({ isHighlight: true }));

      expect(putSpy).toHaveBeenCalledWith(expect.objectContaining({ isHighlight: true }));
    });
  });

  describe('deleteSetlistItem', () => {
    it('deletes using a zero-padded orderStr', async () => {
      const deleteSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(ConcertLogItemEntity.delete).mockImplementation(deleteSpy as never);

      await deleteSetlistItem('u1', 'e1', 3);

      expect(deleteSpy).toHaveBeenCalledWith({ userId: 'u1', eventId: 'e1', orderStr: '0003' });
    });
  });

  describe('listUserSetlist', () => {
    it('queries primary in ascending order', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ order: 0 }, { order: 1 }] });
      vi.mocked(ConcertLogItemEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await listUserSetlist('u1', 'e1');

      expect(ConcertLogItemEntity.query.primary).toHaveBeenCalledWith({
        userId: 'u1',
        eventId: 'e1',
      });
      expect(goSpy).toHaveBeenCalledWith({ order: 'asc' });
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when there is no data', async () => {
      vi.mocked(ConcertLogItemEntity.query.primary).mockReturnValue(goResolves(undefined) as never);

      expect(await listUserSetlist('u1', 'e1')).toEqual([]);
    });
  });

  describe('listEventSetlistItems', () => {
    it('queries byEvent in ascending order across all pages', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ order: 0 }] });
      vi.mocked(ConcertLogItemEntity.query.byEvent).mockReturnValue({ go: goSpy } as never);

      const result = await listEventSetlistItems('e1');

      expect(ConcertLogItemEntity.query.byEvent).toHaveBeenCalledWith({ eventId: 'e1' });
      expect(goSpy).toHaveBeenCalledWith({ order: 'asc', pages: 'all' });
      expect(result).toHaveLength(1);
    });
  });

  describe('listPerformancesByComposition', () => {
    it('queries with the computed composition performance key and default limit', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ order: 0 }] });
      vi.mocked(ConcertLogItemEntity.query.byComposition).mockReturnValue({ go: goSpy } as never);

      const result = await listPerformancesByComposition('comp-1');

      expect(ConcertLogItemEntity.query.byComposition).toHaveBeenCalledWith({
        compositionPerfKey: 'COMPOSITION_PERFORMANCES#comp-1',
      });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc', limit: 20 }));
      expect(result.items).toHaveLength(1);
    });
  });

  describe('listPerformancesByRaga', () => {
    it('queries with the computed raga performance key', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(ConcertLogItemEntity.query.byRaga).mockReturnValue({ go: goSpy } as never);

      await listPerformancesByRaga('raga-1', { limit: 5 });

      expect(ConcertLogItemEntity.query.byRaga).toHaveBeenCalledWith({
        ragaPerfKey: 'RAGA_PERFORMANCES#raga-1',
      });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
    });
  });

  describe('listPendingFreeTextItems', () => {
    it('queries the fixed pendingModerationKey partition', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(ConcertLogItemEntity.query.byPendingModeration).mockReturnValue({
        go: goSpy,
      } as never);

      await listPendingFreeTextItems();

      expect(ConcertLogItemEntity.query.byPendingModeration).toHaveBeenCalledWith({
        pendingModerationKey: '1',
      });
    });
  });

  describe('linkFreeTextToComposition', () => {
    it('patches compositionId and moderator review fields', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves({ compositionId: 'comp-1' }));
      vi.mocked(ConcertLogItemEntity.patch).mockReturnValue({ set: setSpy } as never);

      await linkFreeTextToComposition('u1', 'e1', 2, 'comp-1', 'mod-1');

      expect(ConcertLogItemEntity.patch).toHaveBeenCalledWith({
        userId: 'u1',
        eventId: 'e1',
        orderStr: '0002',
      });
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ compositionId: 'comp-1', moderatorId: 'mod-1' })
      );
    });
  });

  describe('rejectFreeTextItem', () => {
    it('patches moderator rejection fields', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves({}));
      vi.mocked(ConcertLogItemEntity.patch).mockReturnValue({ set: setSpy } as never);

      await rejectFreeTextItem('u1', 'e1', 1, 'mod-1', 'not_a_composition');

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          moderatorId: 'mod-1',
          moderatorRejectedReason: 'not_a_composition',
        })
      );
    });
  });

  describe('deleteAllUserSetlistItems', () => {
    it('deletes every item in the user setlist', async () => {
      vi.mocked(ConcertLogItemEntity.query.primary).mockReturnValue(
        goResolves([{ orderStr: '0000' }, { orderStr: '0001' }]) as never
      );
      const deleteSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(ConcertLogItemEntity.delete).mockImplementation(deleteSpy as never);

      await deleteAllUserSetlistItems('u1', 'e1');

      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when the setlist is empty', async () => {
      vi.mocked(ConcertLogItemEntity.query.primary).mockReturnValue(goResolves([]) as never);

      await deleteAllUserSetlistItems('u1', 'e1');

      expect(ConcertLogItemEntity.delete).not.toHaveBeenCalled();
    });
  });

  describe('replaceUserSetlist', () => {
    function mockExisting(items: Array<{ orderStr: string }>) {
      vi.mocked(ConcertLogItemEntity.query.primary).mockReturnValue(goResolves(items) as never);
    }

    function mockDeleteAndPut() {
      vi.mocked(ConcertLogItemEntity.delete).mockImplementation(
        (args: { orderStr: string }) =>
          ({
            go: vi.fn().mockResolvedValue({ data: undefined }),
            params: vi.fn().mockReturnValue({
              Key: { orderStr: args.orderStr },
              TableName: 'RasikaLifeTable',
            }),
          }) as never
      );
      vi.mocked(ConcertLogItemEntity.put).mockImplementation(
        (args: Record<string, unknown>) =>
          ({
            go: vi.fn().mockResolvedValue({ data: args }),
            params: vi.fn().mockReturnValue({ Item: args, TableName: 'RasikaLifeTable' }),
          }) as never
      );
    }

    it('only deletes rows whose order is no longer present, and puts every incoming item', async () => {
      mockExisting([{ orderStr: '0000' }, { orderStr: '0001' }]);
      mockDeleteAndPut();
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      await replaceUserSetlist('u1', 'e1', [{ ...baseInput(), order: 0 }]);

      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        TransactItems: Array<{ Delete?: unknown; Put?: unknown }>;
      };
      const deletes = command.TransactItems.filter(op => 'Delete' in op);
      const puts = command.TransactItems.filter(op => 'Put' in op);
      expect(deletes).toHaveLength(1);
      expect(puts).toHaveLength(1);
    });

    it('does not call dynamoClient when there is nothing to delete or put', async () => {
      mockExisting([]);
      mockDeleteAndPut();

      await replaceUserSetlist('u1', 'e1', []);

      expect(dynamoClient.send).not.toHaveBeenCalled();
    });

    it('throws before sending when the combined op count would exceed 100', async () => {
      mockExisting(
        Array.from({ length: 60 }, (_, i) => ({ orderStr: i.toString().padStart(4, '0') }))
      );
      mockDeleteAndPut();
      const items = Array.from({ length: 50 }, (_, i) => ({ ...baseInput(), order: i + 100 }));

      await expect(replaceUserSetlist('u1', 'e1', items)).rejects.toThrow(
        /Transaction would exceed DynamoDB 100-op limit/
      );
      expect(dynamoClient.send).not.toHaveBeenCalled();
    });
  });
});
