import { z } from 'zod';
import {
  createArtist,
  createArtistSchema,
  getArtist,
  getPopularArtists,
  incrementViewCount,
  searchArtists,
  updateArtist,
  updateArtistSchema,
} from '@rasika/core';
import { createRouter, rateLimitedProcedure, searchProcedure, writeProcedure } from '../server';
import { idWithViewTrackingSchema } from '../schemas';
import { artistSearchParamsSchema } from '../schemas/artist';

export const artistRouter = createRouter({
  // Queries
  getById: rateLimitedProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const artist = await getArtist(input.id);

    // Track view if enabled and not a bot
    if (artist && input.trackView && !ctx.isBot) {
      await incrementViewCount(input.id);
    }

    return artist;
  }),

  search: searchProcedure.input(artistSearchParamsSchema).query(async ({ input }) => {
    return searchArtists(input);
  }),

  getPopular: rateLimitedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      return getPopularArtists(input.limit);
    }),

  // Mutations
  create: writeProcedure.input(createArtistSchema).mutation(async ({ input, ctx }) => {
    return createArtist({
      ...input,
      editedBy: [ctx.user.id],
    });
  }),

  update: writeProcedure.input(updateArtistSchema).mutation(async ({ input }) => {
    const { id, ...updateData } = input;
    return updateArtist(id, updateData);
  }),
});
