import { Raga } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, moderatorProcedure, publicProcedure } from '../trpc';

export const ragaRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Raga.getRaga(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Raga.listRagas(input)),

  create: publicProcedure
    .input(Raga.CreateRagaSchema)
    .mutation(async ({ input }) => {
      const result = await Raga.createRaga(input);
      triggerReindex();
      return result;
    }),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Raga.UpdateRagaSchema }))
    .mutation(async ({ input }) => {
      const result = await Raga.updateRaga(input.id, input.data);
      triggerReindex();
      return result;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Raga.deleteRaga(input.id);
      triggerReindex();
      return result;
    }),

  byMela: publicProcedure
    .input(
      z.object({ melaNumber: z.number().int().min(1).max(72), excludeId: z.string().optional() })
    )
    .query(({ input }) => Raga.getRagasByMelaNumber(input.melaNumber, input.excludeId)),

  getByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Raga.getRagaByName(input.name)),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Raga.getRaga(input.idA),
        Raga.getRaga(input.idB),
        Raga.getRagaMergeScore(input.idA),
        Raga.getRagaMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.name, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),
});
