import { Tala } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
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

  create: publicProcedure.input(Tala.CreateTalaSchema).mutation(async ({ input }) => {
    const result = await Tala.createTala(input);
    triggerReindex();
    return result;
  }),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Tala.UpdateTalaSchema }))
    .mutation(async ({ input }) => {
      const result = await Tala.updateTala(input.id, input.data);
      triggerReindex();
      return result;
    }),

  delete: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
    const result = await Tala.deleteTala(input.id);
    triggerReindex();
    return result;
  }),

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
