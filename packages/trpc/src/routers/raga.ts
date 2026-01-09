import { RagaRepository, createRagaSchema, updateRagaSchema } from '@rasika/core';
import { z } from 'zod';
import { idWithViewTrackingSchema } from '../schemas';
import { ragaSearchParamsSchema } from '../schemas/raga';
import { createRouter, rateLimitedProcedure, searchProcedure, writeProcedure } from '../server';

export const ragaRouter = createRouter({
  // Queries
  getById: rateLimitedProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const raga = await RagaRepository.getById(input.id);

    // Track view if enabled and not a bot
    if (raga && input.trackView && !ctx.isBot) {
      await RagaRepository.incrementViewCount(input.id);
    }

    return raga;
  }),

  getByName: rateLimitedProcedure
    .input(
      z.object({
        name: z.string(),
        trackView: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const raga = await RagaRepository.getByName(input.name);

      // Track view if enabled and not a bot
      if (raga && input.trackView && !ctx.isBot) {
        await RagaRepository.incrementViewCount(raga.id);
      }

      return raga;
    }),

  search: searchProcedure.input(ragaSearchParamsSchema).query(async ({ input }) => {
    return RagaRepository.searchRagas(input);
  }),

  // Mutations
  create: writeProcedure.input(createRagaSchema).mutation(async ({ input, ctx }) => {
    return RagaRepository.create({
      ...input,
      editorId: ctx.user.id,
    });
  }),

  update: writeProcedure.input(updateRagaSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return RagaRepository.update(id, {
      ...updateData,
      editorId: ctx.user.id,
    });
  }),
});
