import { Organiser } from '@rasika/core';
import { z } from 'zod';
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

  create: editorProcedure
    .input(Organiser.CreateOrganiserSchema)
    .mutation(({ input }) => Organiser.createOrganiser(input)),

  update: editorProcedure
    .input(z.object({ id: z.string().min(1), data: Organiser.UpdateOrganiserSchema }))
    .mutation(({ input }) => Organiser.updateOrganiser(input.id, input.data)),

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
