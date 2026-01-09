import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { CompositionRepository, Composition } from '@rasikalife/core/composition';

export const compositionRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => CompositionRepository.getById(input.id)),

  create: publicProcedure
    .input(Composition.CreateCompositionSchema)
    .mutation(async ({ input }) => CompositionRepository.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), data: Composition.UpdateCompositionSchema }))
    .mutation(async ({ input }) => CompositionRepository.update(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => CompositionRepository.delete(input.id)),

  byArtist: publicProcedure
    .input(z.object({ artistId: z.string() }))
    .query(async ({ input }) => CompositionRepository.getByArtistId(input.artistId)),
});
