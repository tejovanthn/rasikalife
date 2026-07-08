import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  TABLE_NAME: 'RasikaLifeTable',
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', () => ({
  RsvpEntity: {
    get: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../event/entity', () => ({
  EventEntity: { get: vi.fn() },
}));

import { getEventRsvpInfo, getRsvpCount, getUserRsvp, toggleRsvp } from '.';
import { dynamoClient } from '../../db/client';
import { EventEntity } from '../event/entity';
import { RsvpEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

describe('rsvp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleRsvp', () => {
    it('creates an RSVP and increments the counter when not already going', async () => {
      vi.mocked(RsvpEntity.get).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(RsvpEntity.create).mockReturnValue(
        goResolves({ eventId: 'e1', userId: 'u1' }) as never
      );
      vi.mocked(dynamoClient.send).mockResolvedValue({ Attributes: { rsvpCount: 5 } } as never);

      const result = await toggleRsvp('e1', 'u1');

      expect(RsvpEntity.create).toHaveBeenCalledWith({ eventId: 'e1', userId: 'u1' });
      expect(RsvpEntity.delete).not.toHaveBeenCalled();
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        UpdateExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
      };
      expect(command.UpdateExpression).toBe('ADD rsvpCount :delta');
      expect(command.ExpressionAttributeValues).toEqual({ ':delta': 1 });
      expect(result).toEqual({ isGoing: true, count: 5 });
    });

    it('deletes the RSVP and decrements the counter when already going', async () => {
      vi.mocked(RsvpEntity.get).mockReturnValue(
        goResolves({ eventId: 'e1', userId: 'u1' }) as never
      );
      vi.mocked(RsvpEntity.delete).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(dynamoClient.send).mockResolvedValue({ Attributes: { rsvpCount: 4 } } as never);

      const result = await toggleRsvp('e1', 'u1');

      expect(RsvpEntity.delete).toHaveBeenCalledWith({ eventId: 'e1', userId: 'u1' });
      expect(RsvpEntity.create).not.toHaveBeenCalled();
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        ExpressionAttributeValues: Record<string, unknown>;
      };
      expect(command.ExpressionAttributeValues).toEqual({ ':delta': -1 });
      expect(result).toEqual({ isGoing: false, count: 4 });
    });

    it('defaults count to 0 when the counter update returns no Attributes', async () => {
      vi.mocked(RsvpEntity.get).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(RsvpEntity.create).mockReturnValue(goResolves({}) as never);
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      const result = await toggleRsvp('e1', 'u1');

      expect(result.count).toBe(0);
    });

    it('toggling twice returns to the original isGoing state (idempotent pair)', async () => {
      vi.mocked(RsvpEntity.get).mockReturnValueOnce(goResolves(undefined) as never);
      vi.mocked(RsvpEntity.create).mockReturnValue(goResolves({}) as never);
      vi.mocked(dynamoClient.send).mockResolvedValueOnce({ Attributes: { rsvpCount: 1 } } as never);
      const first = await toggleRsvp('e1', 'u1');

      vi.mocked(RsvpEntity.get).mockReturnValueOnce(
        goResolves({ eventId: 'e1', userId: 'u1' }) as never
      );
      vi.mocked(RsvpEntity.delete).mockReturnValue(goResolves(undefined) as never);
      vi.mocked(dynamoClient.send).mockResolvedValueOnce({ Attributes: { rsvpCount: 0 } } as never);
      const second = await toggleRsvp('e1', 'u1');

      expect(first.isGoing).toBe(true);
      expect(second.isGoing).toBe(false);
    });

    it('leaves the RSVP row written even if the counter update fails, risking count drift', async () => {
      // toggleRsvp runs the entity write and the counter update concurrently via
      // Promise.all. If the counter update rejects, Promise.all rejects too, but the
      // entity create/delete may have already succeeded — there's no rollback. This
      // pins down that the RSVP row and the counter can end up out of sync.
      vi.mocked(RsvpEntity.get).mockReturnValue(goResolves(undefined) as never);
      let createResolved = false;
      vi.mocked(RsvpEntity.create).mockReturnValue({
        go: vi.fn().mockImplementation(async () => {
          createResolved = true;
          return { data: { eventId: 'e1', userId: 'u1' } };
        }),
      } as never);
      vi.mocked(dynamoClient.send).mockRejectedValue(new Error('ConditionalCheckFailed'));

      await expect(toggleRsvp('e1', 'u1')).rejects.toThrow('ConditionalCheckFailed');
      expect(createResolved).toBe(true);
      expect(RsvpEntity.create).toHaveBeenCalled();
    });
  });

  describe('getRsvpCount', () => {
    it('returns the rsvpCount from the event record', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves({ rsvpCount: 7 }) as never);

      expect(await getRsvpCount('e1')).toBe(7);
    });

    it('defaults to 0 when the event has no rsvpCount', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves({}) as never);

      expect(await getRsvpCount('e1')).toBe(0);
    });

    it('defaults to 0 when the event does not exist', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getRsvpCount('missing')).toBe(0);
    });
  });

  describe('getUserRsvp', () => {
    it('returns true when the user has an RSVP for the event', async () => {
      vi.mocked(RsvpEntity.get).mockReturnValue(
        goResolves({ eventId: 'e1', userId: 'u1' }) as never
      );

      expect(await getUserRsvp('e1', 'u1')).toBe(true);
    });

    it('returns false when the user has no RSVP for the event', async () => {
      vi.mocked(RsvpEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getUserRsvp('e1', 'u1')).toBe(false);
    });
  });

  describe('getEventRsvpInfo', () => {
    it('returns count and isGoing together for a logged-in user', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves({ rsvpCount: 3 }) as never);
      vi.mocked(RsvpEntity.get).mockReturnValue(
        goResolves({ eventId: 'e1', userId: 'u1' }) as never
      );

      expect(await getEventRsvpInfo('e1', 'u1')).toEqual({ count: 3, isGoing: true });
    });

    it('returns isGoing false without querying RSVP when no userId is given', async () => {
      vi.mocked(EventEntity.get).mockReturnValue(goResolves({ rsvpCount: 3 }) as never);

      const result = await getEventRsvpInfo('e1');

      expect(result).toEqual({ count: 3, isGoing: false });
      expect(RsvpEntity.get).not.toHaveBeenCalled();
    });
  });
});
