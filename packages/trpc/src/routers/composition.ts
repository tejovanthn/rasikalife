import {
  CompositionRepository,
  attributionSchema,
  createCompositionSchema,
  updateAttributionSchema,
  updateCompositionSchema,
} from '@rasika/core';
import { z } from 'zod';
import { idWithViewTrackingSchema } from '../schemas';
import {
  attributionSearchParamsSchema,
  compositionSearchParamsSchema,
} from '../schemas/composition';
import { createRouter, rateLimitedProcedure, searchProcedure, writeProcedure } from '../server';

export const compositionRouter = createRouter({
  // Composition Queries
  getById: rateLimitedProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const composition = await CompositionRepository.getById(input.id);

    // Track view if enabled and not a bot
    if (composition && input.trackView && !ctx.isBot) {
      await CompositionRepository.incrementViewCount(input.id);
    }

    return composition;
  }),

  getWithAttributions: rateLimitedProcedure
    .input(
      z.object({
        id: z.string(),
        trackView: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const composition = await CompositionRepository.getWithAttributions(input.id);

      // Track view if enabled and not a bot
      if (composition && input.trackView && !ctx.isBot) {
        await CompositionRepository.incrementViewCount(input.id);
      }

      return composition;
    }),

  search: searchProcedure.input(compositionSearchParamsSchema).query(async ({ input }) => {
    return CompositionRepository.search(input);
  }),

  getPopular: rateLimitedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      return CompositionRepository.getPopular(input.limit);
    }),

  getBySourceUrl: rateLimitedProcedure
    .input(z.object({ sourceUrl: z.string().url() }))
    .query(async ({ input }) => {
      return CompositionRepository.getBySourceUrl(input.sourceUrl);
    }),

  // Composition Mutations
  create: writeProcedure.input(createCompositionSchema).mutation(async ({ input, ctx }) => {
    return CompositionRepository.create({
      ...input,
      editorId: ctx.user.id,
    });
  }),

  update: writeProcedure.input(updateCompositionSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return CompositionRepository.update(id, {
      ...updateData,
      id,
      editorId: ctx.user.id,
    });
  }),

  // Attribution Queries
  getAttribution: rateLimitedProcedure
    .input(
      z.object({
        compositionId: z.string(),
        artistId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return CompositionRepository.getAttribution(input.compositionId, input.artistId);
    }),

  searchAttributions: searchProcedure
    .input(attributionSearchParamsSchema)
    .query(async ({ input }) => {
      return CompositionRepository.searchAttributions(input);
    }),

  // Attribution Mutations
  createAttribution: writeProcedure.input(attributionSchema).mutation(async ({ input, ctx }) => {
    return CompositionRepository.createAttribution({
      ...input,
      addedBy: ctx.user.id,
    });
  }),

  updateAttribution: writeProcedure
    .input(updateAttributionSchema)
    .mutation(async ({ input, ctx }) => {
      return CompositionRepository.updateAttribution(input);
    }),

  verifyAttribution: writeProcedure
    .input(
      z.object({
        compositionId: z.string(),
        artistId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return CompositionRepository.verifyAttribution(
        input.compositionId,
        input.artistId,
        ctx.user.id
      );
    }),
});
