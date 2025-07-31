import { TalaService, createTalaSchema, updateTalaSchema } from '@rasika/core';
import { z } from 'zod';
import { idWithViewTrackingSchema } from '../schemas';
import { talaSearchParamsSchema } from '../schemas/tala';
import { createRouter, rateLimitedProcedure, searchProcedure, writeProcedure } from '../server';

export const talaRouter = createRouter({
  // Queries
  getById: rateLimitedProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const tala = await TalaService.getTala(input.id, input.version);

    // Track view if enabled and not a bot
    if (tala && input.trackView && !ctx.isBot) {
      await TalaService.incrementViewCount(input.id);
    }

    return tala;
  }),

  getByName: rateLimitedProcedure
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

  search: searchProcedure.input(talaSearchParamsSchema).query(async ({ input }) => {
    return TalaService.searchTalas(input);
  }),

  getVersionHistory: rateLimitedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return TalaService.getVersionHistory(input.id);
    }),

  // Mutations
  create: writeProcedure.input(createTalaSchema).mutation(async ({ input, ctx }) => {
    return TalaService.createTala({
      ...input,
      addedBy: ctx.user.id,
    });
  }),

  update: writeProcedure.input(updateTalaSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return TalaService.updateTala(id, {
      ...updateData,
      editedBy: ctx.user.id,
    });
  }),
});
