import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', () => ({
  EventSetlistEntity: {
    query: { primary: vi.fn(), byStatus: vi.fn() },
    delete: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

// The reconcile module is covered by its own reconcile.test.ts — stub it here so importing
// from '.' doesn't pull in its dependency chain.
vi.mock('./reconcile', () => ({ recomputeEventSetlist: vi.fn() }));

import {
  deleteAllEventSetlistRows,
  getEventSetlist,
  listDisputedSetlistItems,
  unlockEventSetlistRow,
  updateEventSetlistRow,
  verifyEventSetlistRow,
  writeEventSetlistRows,
} from '.';
import { dynamoClient } from '../../db/client';
import { EventSetlistEntity } from './entity';
import type { EventSetlist } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function makeRow(overrides: Partial<EventSetlist> = {}): EventSetlist {
  return {
    eventId: 'e1',
    orderStr: '0000',
    order: 0,
    compositionTitle: 'Vatapi Ganapatim',
    status: 'derived',
    ...overrides,
  } as unknown as EventSetlist;
}

describe('event-setlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEventSetlist', () => {
    it('queries primary in ascending order across all pages', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [makeRow()] });
      vi.mocked(EventSetlistEntity.query.primary).mockReturnValue({ go: goSpy } as never);

      const result = await getEventSetlist('e1');

      expect(EventSetlistEntity.query.primary).toHaveBeenCalledWith({ eventId: 'e1' });
      expect(goSpy).toHaveBeenCalledWith({ order: 'asc', pages: 'all' });
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteAllEventSetlistRows', () => {
    it('is a no-op when there are no rows', async () => {
      vi.mocked(EventSetlistEntity.query.primary).mockReturnValue(goResolves([]) as never);

      await deleteAllEventSetlistRows('e1');

      expect(dynamoClient.send).not.toHaveBeenCalled();
    });

    it('deletes every existing row in a single transaction when under the 100-op limit', async () => {
      vi.mocked(EventSetlistEntity.query.primary).mockReturnValue(
        goResolves([makeRow({ orderStr: '0000' }), makeRow({ orderStr: '0001' })]) as never
      );
      vi.mocked(EventSetlistEntity.delete).mockImplementation(
        (args: { orderStr: string }) =>
          ({
            params: vi.fn().mockReturnValue({ Key: args, TableName: 'RasikaLifeTable' }),
          }) as never
      );
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      await deleteAllEventSetlistRows('e1');

      expect(dynamoClient.send).toHaveBeenCalledTimes(1);
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        TransactItems: unknown[];
      };
      expect(command.TransactItems).toHaveLength(2);
    });

    it('batches deletes across multiple transactions when over the 100-op limit', async () => {
      const rows = Array.from({ length: 150 }, (_, i) =>
        makeRow({ orderStr: i.toString().padStart(4, '0') })
      );
      vi.mocked(EventSetlistEntity.query.primary).mockReturnValue(goResolves(rows) as never);
      vi.mocked(EventSetlistEntity.delete).mockImplementation(
        (args: { orderStr: string }) =>
          ({
            params: vi.fn().mockReturnValue({ Key: args, TableName: 'RasikaLifeTable' }),
          }) as never
      );
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      await deleteAllEventSetlistRows('e1');

      expect(dynamoClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('writeEventSetlistRows', () => {
    function mockPutAndDelete() {
      vi.mocked(EventSetlistEntity.delete).mockImplementation(
        (args: { orderStr: string }) =>
          ({
            params: vi.fn().mockReturnValue({ Key: args, TableName: 'RasikaLifeTable' }),
          }) as never
      );
      vi.mocked(EventSetlistEntity.put).mockImplementation(
        (row: EventSetlist) =>
          ({
            params: vi.fn().mockReturnValue({ Item: row, TableName: 'RasikaLifeTable' }),
          }) as never
      );
    }

    it('is a no-op when there is nothing to delete or write', async () => {
      mockPutAndDelete();

      await writeEventSetlistRows('e1', [], []);

      expect(dynamoClient.send).not.toHaveBeenCalled();
    });

    it('sends a single transaction combining deletes and puts when within the limit', async () => {
      mockPutAndDelete();
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      await writeEventSetlistRows(
        'e1',
        [makeRow({ orderStr: '0000' })],
        [makeRow({ orderStr: '0001' })]
      );

      expect(dynamoClient.send).toHaveBeenCalledTimes(1);
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        TransactItems: Array<{ Delete?: unknown; Put?: unknown }>;
      };
      expect(command.TransactItems.filter(op => 'Delete' in op)).toHaveLength(1);
      expect(command.TransactItems.filter(op => 'Put' in op)).toHaveLength(1);
    });

    it('splits deletes and puts into separate batched transactions when over the 100-op limit', async () => {
      mockPutAndDelete();
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);
      const existing = Array.from({ length: 60 }, (_, i) =>
        makeRow({ orderStr: i.toString().padStart(4, '0') })
      );
      const rows = Array.from({ length: 60 }, (_, i) =>
        makeRow({ orderStr: (i + 100).toString().padStart(4, '0') })
      );

      await writeEventSetlistRows('e1', rows, existing);

      // 60 deletes + 60 puts = 120 ops > 100, so it falls back to per-op-type batching.
      expect(dynamoClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('listDisputedSetlistItems', () => {
    it('queries byStatus for disputed rows with a default limit of 20', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [makeRow({ status: 'disputed' })] });
      vi.mocked(EventSetlistEntity.query.byStatus).mockReturnValue({ go: goSpy } as never);

      const result = await listDisputedSetlistItems();

      expect(EventSetlistEntity.query.byStatus).toHaveBeenCalledWith({ status: 'disputed' });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc', limit: 20 }));
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateEventSetlistRow / verifyEventSetlistRow / unlockEventSetlistRow', () => {
    it('patches using a zero-padded orderStr', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(makeRow()));
      vi.mocked(EventSetlistEntity.patch).mockReturnValue({ set: setSpy } as never);

      await updateEventSetlistRow('e1', 7, { compositionTitle: 'New Title' });

      expect(EventSetlistEntity.patch).toHaveBeenCalledWith({ eventId: 'e1', orderStr: '0007' });
      expect(setSpy).toHaveBeenCalledWith({ compositionTitle: 'New Title' });
    });

    it('verify sets status to verified in addition to the given updates', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(makeRow({ status: 'verified' })));
      vi.mocked(EventSetlistEntity.patch).mockReturnValue({ set: setSpy } as never);

      await verifyEventSetlistRow('e1', 0, { compositionTitle: 'Confirmed Title' });

      expect(setSpy).toHaveBeenCalledWith({
        compositionTitle: 'Confirmed Title',
        status: 'verified',
      });
    });

    it('unlock sets status to derived', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(makeRow({ status: 'derived' })));
      vi.mocked(EventSetlistEntity.patch).mockReturnValue({ set: setSpy } as never);

      await unlockEventSetlistRow('e1', 0);

      expect(setSpy).toHaveBeenCalledWith({ status: 'derived' });
    });
  });
});
