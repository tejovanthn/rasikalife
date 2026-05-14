import { ConcertLog } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

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
});
