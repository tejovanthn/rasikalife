import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  TABLE_NAME: 'RasikaLifeTable',
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./entity')>();
  return {
    // Real conversions so keyOfEntity derives the true (lowercased) key.
    ConcertLogEntity: {
      conversions: actual.ConcertLogEntity.conversions,
      get: vi.fn(),
      patch: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      query: { byUserDate: vi.fn(), byEvent: vi.fn() },
    },
  };
});

vi.mock('../event/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('../event/entity')>();
  return {
    EventEntity: { conversions: actual.EventEntity.conversions, get: vi.fn() },
  };
});
vi.mock('../rsvp/entity', () => ({ RsvpEntity: { query: { byUser: vi.fn() } } }));
vi.mock('../event', () => ({ getEvent: vi.fn() }));

import {
  deleteConcertLog,
  getAttendedCount,
  getConcertLog,
  listEventConcertLogs,
  listPastRsvpedWithoutLogs,
  listUserConcertLogs,
  upsertConcertLog,
} from '.';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { getEvent } from '../event';
import { EventEntity } from '../event/entity';
import { RsvpEntity } from '../rsvp/entity';
import { ConcertLogEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

describe('concert-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertConcertLog', () => {
    it('patches notes on an existing log, keeping the old note when none is provided', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(
        goResolves({ userId: 'u1', eventId: 'e1', notes: 'old note' }) as never
      );
      const setSpy = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: { userId: 'u1', eventId: 'e1', notes: 'old note' } }),
      });
      vi.mocked(ConcertLogEntity.patch).mockReturnValue({ set: setSpy } as never);

      const result = await upsertConcertLog('u1', 'e1');

      expect(setSpy).toHaveBeenCalledWith({ notes: 'old note' });
      expect(result.notes).toBe('old note');
      expect(getEvent).not.toHaveBeenCalled();
    });

    it('patches notes on an existing log with the newly provided value', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(
        goResolves({ userId: 'u1', eventId: 'e1', notes: 'old note' }) as never
      );
      const setSpy = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: { userId: 'u1', eventId: 'e1', notes: 'new note' } }),
      });
      vi.mocked(ConcertLogEntity.patch).mockReturnValue({ set: setSpy } as never);

      await upsertConcertLog('u1', 'e1', { notes: 'new note' });

      expect(setSpy).toHaveBeenCalledWith({ notes: 'new note' });
    });

    it('creates a new log denormalized from the event and bumps the attended counter', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(getEvent).mockResolvedValue({
        id: 'e1',
        title: 'Margazhi Concert',
        startDateTime: '2026-01-01T18:00:00.000Z',
        venueName: 'Music Academy',
        artists: [{ id: 'a1', name: 'Sanjay' }],
      } as never);
      vi.mocked(ConcertLogEntity.create).mockReturnValue(
        goResolves({ userId: 'u1', eventId: 'e1' }) as never
      );
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      const result = await upsertConcertLog('u1', 'e1', { notes: 'great show' });

      expect(ConcertLogEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          eventId: 'e1',
          eventTitle: 'Margazhi Concert',
          venueName: 'Music Academy',
          artistNames: ['Sanjay'],
          notes: 'great show',
        })
      );
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        UpdateExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
      };
      expect(command.UpdateExpression).toBe('ADD attendedCount :delta');
      expect(command.ExpressionAttributeValues).toEqual({ ':delta': 1 });
      expect(result).toEqual({ userId: 'u1', eventId: 'e1' });
    });

    it('throws when creating a log for an event that does not exist', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(getEvent).mockResolvedValue(null);

      await expect(upsertConcertLog('u1', 'missing')).rejects.toThrow('Event missing not found');
      expect(ConcertLogEntity.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteConcertLog', () => {
    it('deletes an existing log and decrements the attended counter', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(
        goResolves({ userId: 'u1', eventId: 'e1' }) as never
      );
      vi.mocked(ConcertLogEntity.delete).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      await deleteConcertLog('u1', 'e1');

      expect(ConcertLogEntity.delete).toHaveBeenCalledWith({ userId: 'u1', eventId: 'e1' });
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        ExpressionAttributeValues: Record<string, unknown>;
      };
      expect(command.ExpressionAttributeValues).toEqual({ ':delta': -1 });
    });

    it('is a no-op when there is no existing log', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(goResolves(undefined) as never);

      await deleteConcertLog('u1', 'e1');

      expect(ConcertLogEntity.delete).not.toHaveBeenCalled();
      expect(dynamoClient.send).not.toHaveBeenCalled();
    });
  });

  describe('getConcertLog', () => {
    it('returns the log when found', async () => {
      const log = { userId: 'u1', eventId: 'e1' };
      vi.mocked(ConcertLogEntity.get).mockReturnValue(goResolves(log) as never);

      expect(await getConcertLog('u1', 'e1')).toEqual(log);
    });

    it('returns null when not found', async () => {
      vi.mocked(ConcertLogEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getConcertLog('u1', 'e1')).toBeNull();
    });
  });

  describe('listUserConcertLogs', () => {
    it('queries byUserDate descending with a default limit of 50', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ userId: 'u1', eventId: 'e1' }] });
      vi.mocked(ConcertLogEntity.query.byUserDate).mockReturnValue({ go: goSpy } as never);

      const result = await listUserConcertLogs('u1');

      expect(ConcertLogEntity.query.byUserDate).toHaveBeenCalledWith({ userId: 'u1' });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc', limit: 50 }));
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('reports hasMore/nextToken from the cursor', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [], cursor: 'next' });
      vi.mocked(ConcertLogEntity.query.byUserDate).mockReturnValue({ go: goSpy } as never);

      const result = await listUserConcertLogs('u1', { limit: 5, nextToken: 'prev' });

      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, cursor: 'prev' }));
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBe('next');
    });
  });

  describe('listEventConcertLogs', () => {
    it('queries byEvent with a default limit of 20', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ userId: 'u1', eventId: 'e1' }] });
      vi.mocked(ConcertLogEntity.query.byEvent).mockReturnValue({ go: goSpy } as never);

      const result = await listEventConcertLogs('e1');

      expect(ConcertLogEntity.query.byEvent).toHaveBeenCalledWith({ eventId: 'e1' });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getAttendedCount', () => {
    it('returns attendedCount from the event record', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves({ attendedCount: 12 }) as never);

      expect(await getAttendedCount('e1')).toBe(12);
    });

    it('defaults to 0 when missing', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getAttendedCount('e1')).toBe(0);
    });
  });

  describe('listPastRsvpedWithoutLogs', () => {
    function mockBatchGet(
      eventsById: Record<string, { id: string; startDateTime: string }>,
      loggedEventIds: Set<string>
    ) {
      vi.mocked(dynamoClient.send).mockImplementation(async (command: unknown) => {
        const cmd = command as {
          RequestItems: Record<string, { Keys: Array<Record<string, string>> }>;
        };
        const keys = cmd.RequestItems[TABLE_NAME].Keys;
        if (keys[0]?.sk === '#metadata') {
          const items = keys
            .map(k => eventsById[k.pk.replace('event#', '')])
            .filter((e): e is { id: string; startDateTime: string } => !!e);
          return { Responses: { [TABLE_NAME]: items } };
        }
        const items = keys
          .filter(k => loggedEventIds.has(k.sk.replace('concert_log#', '')))
          .map(k => ({ sk: k.sk }));
        return { Responses: { [TABLE_NAME]: items } };
      });
    }

    it('returns an empty array when the user has no RSVPs', async () => {
      vi.mocked(RsvpEntity.query.byUser).mockReturnValue(goResolves([]) as never);

      expect(await listPastRsvpedWithoutLogs('u1')).toEqual([]);
      expect(dynamoClient.send).not.toHaveBeenCalled();
    });

    it('excludes RSVPed events that are in the future', async () => {
      vi.mocked(RsvpEntity.query.byUser).mockReturnValue(
        goResolves([{ eventId: 'future-1' }]) as never
      );
      mockBatchGet(
        { 'future-1': { id: 'future-1', startDateTime: '2099-01-01T00:00:00.000Z' } },
        new Set()
      );

      expect(await listPastRsvpedWithoutLogs('u1')).toEqual([]);
    });

    it('excludes past events that already have a concert log', async () => {
      vi.mocked(RsvpEntity.query.byUser).mockReturnValue(
        goResolves([{ eventId: 'past-1' }]) as never
      );
      mockBatchGet(
        { 'past-1': { id: 'past-1', startDateTime: '2020-01-01T00:00:00.000Z' } },
        new Set(['past-1'])
      );

      expect(await listPastRsvpedWithoutLogs('u1')).toEqual([]);
    });

    it('returns past, unlogged events sorted most-recent-first and capped at the limit', async () => {
      vi.mocked(RsvpEntity.query.byUser).mockReturnValue(
        goResolves([{ eventId: 'past-1' }, { eventId: 'past-2' }, { eventId: 'past-3' }]) as never
      );
      mockBatchGet(
        {
          'past-1': { id: 'past-1', startDateTime: '2020-01-01T00:00:00.000Z' },
          'past-2': { id: 'past-2', startDateTime: '2021-01-01T00:00:00.000Z' },
          'past-3': { id: 'past-3', startDateTime: '2022-01-01T00:00:00.000Z' },
        },
        new Set()
      );

      const result = await listPastRsvpedWithoutLogs('u1', 2);

      expect(result.map(e => e.id)).toEqual(['past-3', 'past-2']);
    });
  });
});
