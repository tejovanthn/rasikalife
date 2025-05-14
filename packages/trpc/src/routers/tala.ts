import { z } from 'zod';
import { createTalaSchema, TalaService, updateTalaSchema } from '@rasika/core';
import { createRouter, publicProcedure, protectedProcedure } from '../server';
import { idWithViewTrackingSchema } from '../schemas';
import { talaSearchParamsSchema } from '../schemas/tala';

export const talaRouter = createRouter({
  // Queries
  getById: publicProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const tala = await TalaService.getTala(input.id, input.version);

    // Track view if enabled and not a bot
    if (tala && input.trackView && !ctx.isBot) {
      await TalaService.incrementViewCount(input.id);
    }

    return tala;
  }),

  getByName: publicProcedure
    .input(
      z.object({
        name: z.string(),
        trackView: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const tala = await TalaService.getTalaByName(input.name);

      // Track view if enabled and not a bot
      if (tala && input.trackView && !ctx.isBot) {
        await TalaService.incrementViewCount(tala.id);
      }

      return tala;
    }),

  search: publicProcedure.input(talaSearchParamsSchema).query(async ({ input }) => {
    return TalaService.searchTalas(input);
  }),

  getVersionHistory: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return TalaService.getVersionHistory(input.id);
    }),

  // Mutations
  create: protectedProcedure.input(createTalaSchema).mutation(async ({ input, ctx }) => {
    return TalaService.createTala({
      ...input,
      addedBy: ctx.user.id,
    });
  }),

  update: protectedProcedure.input(updateTalaSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return TalaService.updateTala(id, {
      ...updateData,
      editedBy: ctx.user.id,
    });
  }),
});
