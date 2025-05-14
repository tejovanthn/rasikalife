import { z } from 'zod';
import {
  attributionSchema,
  CompositionService,
  createCompositionSchema,
  updateAttributionSchema,
  updateCompositionSchema,
} from '@rasika/core';
import { createRouter, publicProcedure, protectedProcedure } from '../server';
import { idWithViewTrackingSchema } from '../schemas';
import {
  compositionSearchParamsSchema,
  attributionSearchParamsSchema,
} from '../schemas/composition';

export const compositionRouter = createRouter({
  // Composition Queries
  getById: publicProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const composition = await CompositionService.getComposition(input.id, input.version);

    // Track view if enabled and not a bot
    if (composition && input.trackView && !ctx.isBot) {
      await CompositionService.incrementViewCount(input.id);
    }

    return composition;
  }),

  getWithAttributions: publicProcedure
    .input(
      z.object({
        id: z.string(),
        trackView: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const composition = await CompositionService.getCompositionWithAttributions(input.id);

      // Track view if enabled and not a bot
      if (composition && input.trackView && !ctx.isBot) {
        await CompositionService.incrementViewCount(input.id);
      }

      return composition;
    }),

  search: publicProcedure.input(compositionSearchParamsSchema).query(async ({ input }) => {
    return CompositionService.searchCompositions(input);
  }),

  getVersionHistory: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return CompositionService.getVersionHistory(input.id);
    }),

  // Composition Mutations
  create: protectedProcedure.input(createCompositionSchema).mutation(async ({ input, ctx }) => {
    return CompositionService.createComposition({
      ...input,
      addedBy: ctx.user.id,
      editedBy: [ctx.user.id],
    });
  }),

  update: protectedProcedure.input(updateCompositionSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return CompositionService.updateComposition(id, {
      ...updateData,
      editedBy: ctx.user.id,
    });
  }),

  // Attribution Queries
  getAttribution: publicProcedure
    .input(
      z.object({
        compositionId: z.string(),
        artistId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return CompositionService.getAttribution(input.compositionId, input.artistId);
    }),

  searchAttributions: publicProcedure
    .input(attributionSearchParamsSchema)
    .query(async ({ input }) => {
      return CompositionService.searchAttributions(input);
    }),

  // Attribution Mutations
  createAttribution: protectedProcedure
    .input(attributionSchema)
    .mutation(async ({ input, ctx }) => {
      return CompositionService.createAttribution({
        ...input,
        addedBy: ctx.user.id,
      });
    }),

  updateAttribution: protectedProcedure
    .input(updateAttributionSchema)
    .mutation(async ({ input, ctx }) => {
      return CompositionService.updateAttribution({
        ...input,
        editedBy: ctx.user.id,
      });
    }),

  verifyAttribution: protectedProcedure
    .input(
      z.object({
        compositionId: z.string(),
        artistId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return CompositionService.verifyAttribution(input.compositionId, input.artistId, ctx.user.id);
    }),
});
