import { Rsvp } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const rsvpRouter = createTRPCRouter({
  getForEvent: publicProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(({ input, ctx }) => Rsvp.getEventRsvpInfo(input.eventId, ctx.user?.id)),

  toggle: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(({ input, ctx }) => Rsvp.toggleRsvp(input.eventId, ctx.user.id)),
});
