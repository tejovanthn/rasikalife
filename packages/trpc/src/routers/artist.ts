import { z } from 'zod';
import { createArtist, createArtistSchema, getArtist, getPopularArtists, incrementViewCount, searchArtists, updateArtist, updateArtistSchema } from '@rasika/core';
import { createRouter, publicProcedure, protectedProcedure } from '../server';
import { idWithViewTrackingSchema } from '../schemas';
import { artistSearchParamsSchema } from '../schemas/artist';

export const artistRouter = createRouter({
  // Queries
  getById: publicProcedure.input(idWithViewTrackingSchema).query(async ({ input, ctx }) => {
    const artist = await getArtist(input.id);

    // Track view if enabled and not a bot
    if (artist && input.trackView && !ctx.isBot) {
      await incrementViewCount(input.id);
    }

    return artist;
  }),

  search: publicProcedure.input(artistSearchParamsSchema).query(async ({ input }) => {
    return searchArtists(input);
  }),

  getPopular: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      return getPopularArtists(input.limit);
    }),

  // Mutations
  create: protectedProcedure.input(createArtistSchema).mutation(async ({ input, ctx }) => {
    return createArtist({
      ...input,
      editedBy: [ctx.user.id],
    });
  }),

  update: protectedProcedure.input(updateArtistSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    return updateArtist(id, updateData);
  }),
});
