import { ArtistRepository, createArtistSchema, updateArtistSchema } from '@rasika/core';
import { z } from 'zod';
import { idWithViewTrackingSchema } from '../schemas';
import { artistSearchParamsSchema } from '../schemas/artist';
import { createRouter, rateLimitedProcedure, searchProcedure, writeProcedure } from '../server';

export const artistRouter = createRouter({
  // Queries
  getById: rateLimitedProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const artist = await ArtistRepository.getById(input.id);

    // Track view if enabled and not a bot
    if (artist && input.trackView && !ctx.isBot) {
      await ArtistRepository.incrementViewCount(input.id);
    }

    return artist;
  }),

  search: searchProcedure.input(artistSearchParamsSchema).query(async ({ input }) => {
    return ArtistRepository.search(input);
  }),

  getPopular: rateLimitedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      return ArtistRepository.getPopular(input.limit);
    }),

  // Mutations
  create: writeProcedure.input(createArtistSchema).mutation(async ({ input, ctx }) => {
    return ArtistRepository.create({
      ...input,
      editedBy: [ctx.user.id],
    });
  }),

  update: writeProcedure.input(updateArtistSchema).mutation(async ({ input }) => {
    const { id, ...updateData } = input;
    return ArtistRepository.update(id, updateData);
  }),
});
