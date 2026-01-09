import { Composition } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const compositionRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Composition.getComposition(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Composition.listCompositions(input)),

  create: publicProcedure
    .input(Composition.CreateCompositionSchema)
    .mutation(({ input }) => Composition.createComposition(input)),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Composition.UpdateCompositionSchema }))
    .mutation(({ input }) => Composition.updateComposition(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => Composition.deleteComposition(input.id)),

  byArtist: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ input }) => Composition.getCompositionsByArtist(input.artistId)),
});
