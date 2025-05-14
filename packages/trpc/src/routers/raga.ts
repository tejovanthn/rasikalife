import { z } from 'zod';
import { createRagaSchema, RagaService, updateRagaSchema } from '@rasika/core';
import { createRouter, publicProcedure, protectedProcedure } from '../server';
import { idWithViewTrackingSchema } from '../schemas';
import { ragaSearchParamsSchema } from '../schemas/raga';

export const ragaRouter = createRouter({
  // Queries
  getById: publicProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const raga = await RagaService.getRaga(input.id, input.version);

    // Track view if enabled and not a bot
    if (raga && input.trackView && !ctx.isBot) {
      await RagaService.incrementViewCount(input.id);
    }

    return raga;
  }),

  getByName: publicProcedure
    .input(
      z.object({
        name: z.string(),
        trackView: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const raga = await RagaService.getRagaByName(input.name);

      // Track view if enabled and not a bot
      if (raga && input.trackView && !ctx.isBot) {
        await RagaService.incrementViewCount(raga.id);
      }

      return raga;
    }),

  search: publicProcedure.input(ragaSearchParamsSchema).query(async ({ input }) => {
    return RagaService.searchRagas(input);
  }),

  getVersionHistory: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return RagaService.getVersionHistory(input.id);
    }),

  // Mutations
  create: protectedProcedure.input(createRagaSchema).mutation(async ({ input, ctx }) => {
    return RagaService.createRaga({
      ...input,
      addedBy: ctx.user.id,
    });
  }),

  update: protectedProcedure.input(updateRagaSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return RagaService.updateRaga(id, {
      ...updateData,
      editedBy: ctx.user.id,
    });
  }),
});
