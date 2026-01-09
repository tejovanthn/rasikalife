import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { ArtistRepository, Artist } from '@rasikalife/core/artist';

export const artistRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => ArtistRepository.getById(input.id)),

  create: publicProcedure
    .input(Artist.CreateArtistSchema)
    .mutation(async ({ input }) => ArtistRepository.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), data: Artist.UpdateArtistSchema }))
    .mutation(async ({ input }) => ArtistRepository.update(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => ArtistRepository.delete(input.id)),
});
