import { TalaRepository, createTalaSchema, updateTalaSchema } from '@rasika/core';
import { z } from 'zod';
import { idWithViewTrackingSchema } from '../schemas';
import { talaSearchParamsSchema } from '../schemas/tala';
import { createRouter, rateLimitedProcedure, searchProcedure, writeProcedure } from '../server';

export const talaRouter = createRouter({
  // Queries
  getById: rateLimitedProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const tala = await TalaRepository.getById(input.id);

    // Track view if enabled and not a bot
    if (tala && input.trackView && !ctx.isBot) {
      await TalaRepository.incrementViewCount(input.id);
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
      const tala = await TalaRepository.getByName(input.name);

      // Track view if enabled and not a bot
      if (tala && input.trackView && !ctx.isBot) {
        await TalaRepository.incrementViewCount(tala.id);
      }

      return tala;
    }),

  search: searchProcedure.input(talaSearchParamsSchema).query(async ({ input }) => {
    return TalaRepository.searchTalas(input);
  }),

  // Mutations
  create: writeProcedure.input(createTalaSchema).mutation(async ({ input, ctx }) => {
    return TalaRepository.create({
      ...input,
      editorId: ctx.user.id,
    });
  }),

  update: writeProcedure.input(updateTalaSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return TalaRepository.update(id, {
      ...updateData,
      editorId: ctx.user.id,
    });
  }),
});
