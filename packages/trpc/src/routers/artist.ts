import { Artist } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const artistRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Artist.getArtist(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Artist.listArtists(input)),

  create: publicProcedure
    .input(Artist.CreateArtistSchema)
    .mutation(({ input }) => Artist.createArtist(input)),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Artist.UpdateArtistSchema }))
    .mutation(({ input }) => Artist.updateArtist(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => Artist.deleteArtist(input.id)),
});
