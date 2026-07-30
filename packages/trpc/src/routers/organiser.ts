import { ArtistAffiliation, Image, Organiser } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

export const organiserRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Organiser.getOrganiser(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Organiser.listOrganisers(input)),

  getByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Organiser.getOrganiserByName(input.name)),

  // The artists on this organisation's faculty, or who founded or direct it. This reverse
  // direction is why affiliations are a junction rather than a list on the artist — a list
  // could not answer it without scanning the table.
  listArtists: publicProcedure
    .input(z.object({ organiserId: z.string().min(1) }))
    .query(({ input }) => ArtistAffiliation.getOrganiserArtists(input.organiserId)),

  create: editorProcedure.input(Organiser.CreateOrganiserSchema).mutation(async ({ input }) => {
    const result = await Organiser.createOrganiser(input);
    triggerReindex();
    return result;
  }),

  update: editorProcedure
    .input(z.object({ id: z.string().min(1), data: Organiser.UpdateOrganiserSchema }))
    .mutation(async ({ input }) => {
      const result = await Organiser.updateOrganiser(input.id, input.data);
      triggerReindex();
      return result;
    }),

  getImageUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(({ input }) =>
      Image.getImageUploadUrl('organiser', input.fileName, input.contentType)
    ),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Organiser.getOrganiser(input.idA),
        Organiser.getOrganiser(input.idB),
        Organiser.getOrganiserMergeScore(input.idA),
        Organiser.getOrganiserMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.name, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),
});
