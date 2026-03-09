import { Image, Venue } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

export const venueRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Venue.getVenue(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Venue.listVenues(input)),

  getByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Venue.getVenueByName(input.name)),

  byCity: publicProcedure
    .input(
      z.object({
        city: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Venue.listVenuesByCity(input.city, input)),

  create: editorProcedure.input(Venue.CreateVenueSchema).mutation(async ({ input }) => {
    const result = await Venue.createVenue(input);
    triggerReindex();
    return result;
  }),

  update: editorProcedure
    .input(z.object({ id: z.string().min(1), data: Venue.UpdateVenueSchema }))
    .mutation(async ({ input }) => {
      const result = await Venue.updateVenue(input.id, input.data);
      triggerReindex();
      return result;
    }),

  getImageUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(({ input }) => Image.getImageUploadUrl('venue', input.fileName, input.contentType)),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Venue.getVenue(input.idA),
        Venue.getVenue(input.idB),
        Venue.getVenueMergeScore(input.idA),
        Venue.getVenueMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.name, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),
});
