import { ConcertLog, ConcertLogItem, EventSetlist } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

const setlistItemSchema = z.object({
  order: z.number().int().min(0),
  compositionId: z.string().min(1).optional(),
  compositionTitle: z.string().min(1).max(500),
  ragaId: z.string().min(1).optional(),
  ragaName: z.string().max(200).optional(),
  talaId: z.string().min(1).optional(),
  talaName: z.string().max(200).optional(),
  compositionType: z.string().optional(),
  publicNote: z.string().max(500).optional(),
  isHighlight: z.boolean().optional(),
});

export const concertLogRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(({ input, ctx }) => ConcertLog.getConcertLog(ctx.user.id, input.eventId)),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input, ctx }) => ConcertLog.listUserConcertLogs(ctx.user.id, input)),

  upsert: protectedProcedure
    .input(z.object({ eventId: z.string().min(1), notes: z.string().max(5000).optional() }))
    .mutation(({ input, ctx }) =>
      ConcertLog.upsertConcertLog(ctx.user.id, input.eventId, { notes: input.notes })
    ),

  delete: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(({ input, ctx }) => ConcertLog.deleteConcertLog(ctx.user.id, input.eventId)),

  countForEvent: publicProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(({ input }) => ConcertLog.getAttendedCount(input.eventId)),

  upsertWithSetlist: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        notes: z.string().max(5000).optional(),
        items: z.array(setlistItemSchema).max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const log = await ConcertLog.upsertConcertLog(ctx.user.id, input.eventId, {
        notes: input.notes,
      });
      const eventStartDateTime = log.eventStartDateTime;

      await ConcertLogItem.replaceUserSetlist(
        ctx.user.id,
        input.eventId,
        input.items.map(item => ({ ...item, eventStartDateTime }))
      );

      const setlist = await EventSetlist.recomputeEventSetlist(input.eventId);
      return { log, setlist };
    }),

  getMySetlistForEvent: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(({ input, ctx }) => ConcertLogItem.listUserSetlist(ctx.user.id, input.eventId)),

  listPastRsvpedWithoutLogs: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }))
    .query(({ input, ctx }) =>
      ConcertLog.listPastRsvpedWithoutLogs(ctx.user.id, input.limit ?? 20)
    ),
});
