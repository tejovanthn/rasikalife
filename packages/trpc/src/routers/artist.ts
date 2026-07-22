import {
  Artist,
  ArtistAward,
  ConcertLogItem,
  EventArtist,
  EventSetlist,
  Image,
} from '@rasika/core';
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

  create: editorProcedure.input(Artist.CreateArtistSchema).mutation(async ({ input }) => {
    const result = await Artist.createArtist(input);
    triggerReindex();
    return result;
  }),

  update: editorProcedure
    .input(z.object({ id: z.string().min(1), data: Artist.UpdateArtistSchema }))
    .mutation(async ({ input }) => {
      const result = await Artist.updateArtist(input.id, input.data);
      triggerReindex();
      return result;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Artist.softDeleteArtist(input.id);
      triggerReindex();
      return result;
    }),

  getImageUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(({ input }) => Image.getImageUploadUrl('artist', input.fileName, input.contentType)),

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

  addAward: editorProcedure.input(ArtistAward.AddArtistAwardSchema).mutation(async ({ input }) => {
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

  getRepertoire: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(async ({ input }) => {
      // Get events where this artist performed
      const { items: eventArtistLinks } = await EventArtist.getEventsByArtist(input.artistId, {
        limit: 50,
      });
      const eventIds = eventArtistLinks.map(ea => ea.eventId);

      if (eventIds.length === 0) {
        return { topCompositions: [], topRagas: [] };
      }

      // Get EventSetlist rows for all those events
      const setlistArrays = await Promise.all(
        eventIds.map(eventId => EventSetlist.getEventSetlist(eventId))
      );
      const allRows = setlistArrays.flat();

      // Count compositions
      const compositionCounts = new Map<string, { title: string; count: number }>();
      for (const row of allRows) {
        if (row.compositionId) {
          const entry = compositionCounts.get(row.compositionId);
          if (entry) {
            entry.count++;
          } else {
            compositionCounts.set(row.compositionId, { title: row.compositionTitle, count: 1 });
          }
        }
      }

      // Count ragas
      const ragaCounts = new Map<string, { name: string; count: number }>();
      for (const row of allRows) {
        if (row.ragaId) {
          const entry = ragaCounts.get(row.ragaId);
          if (entry) {
            entry.count++;
          } else {
            ragaCounts.set(row.ragaId, { name: row.ragaName ?? row.ragaId, count: 1 });
          }
        }
      }

      return {
        topCompositions: [...compositionCounts.entries()]
          .map(([id, { title, count }]) => ({ id, title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        topRagas: [...ragaCounts.entries()]
          .map(([id, { name, count }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    }),
});
