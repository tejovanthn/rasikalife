import { Artist, ArtistAward } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

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
    .mutation(async ({ input }) => {
      const result = await Artist.createArtist(input);
      triggerReindex();
      return result;
    }),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Artist.UpdateArtistSchema }))
    .mutation(async ({ input }) => {
      const result = await Artist.updateArtist(input.id, input.data);
      triggerReindex();
      return result;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Artist.deleteArtist(input.id);
      triggerReindex();
      return result;
    }),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Artist.getArtist(input.idA),
        Artist.getArtist(input.idB),
        Artist.getArtistMergeScore(input.idA),
        Artist.getArtistMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.name, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),

  addAward: editorProcedure
    .input(ArtistAward.AddArtistAwardSchema)
    .mutation(async ({ input }) => {
      const result = await ArtistAward.addArtistAward(input);
      triggerReindex();
      return result;
    }),

  removeAward: editorProcedure
    .input(z.object({ artistId: z.string().min(1), awardId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await ArtistAward.removeArtistAward(input.artistId, input.awardId);
      triggerReindex();
      return result;
    }),

  listAwards: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ input }) => ArtistAward.getArtistAwards(input.artistId)),
});
