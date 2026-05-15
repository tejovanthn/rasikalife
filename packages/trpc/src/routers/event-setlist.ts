import { ConcertLogItem, EventSetlist } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, moderatorProcedure, publicProcedure } from '../trpc';

export const eventSetlistRouter = createTRPCRouter({
  getForEvent: publicProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const [canonical, userOwn] = await Promise.all([
        EventSetlist.getEventSetlist(input.eventId),
        ctx.user
          ? ConcertLogItem.listUserSetlist(ctx.user.id, input.eventId)
          : Promise.resolve(null),
      ]);
      return { canonical, userOwn };
    }),

  recomputeForEvent: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(({ input }) => EventSetlist.recomputeEventSetlist(input.eventId)),
});
