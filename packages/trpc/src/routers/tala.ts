import { Tala } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, moderatorProcedure, publicProcedure } from '../trpc';

export const talaRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Tala.getTala(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Tala.listTalas(input)),

  create: publicProcedure
    .input(Tala.CreateTalaSchema)
    .mutation(({ input }) => Tala.createTala(input)),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Tala.UpdateTalaSchema }))
    .mutation(({ input }) => Tala.updateTala(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => Tala.deleteTala(input.id)),

  getByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Tala.getTalaByName(input.name)),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Tala.getTala(input.idA),
        Tala.getTala(input.idB),
        Tala.getTalaMergeScore(input.idA),
        Tala.getTalaMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.name, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),
});
