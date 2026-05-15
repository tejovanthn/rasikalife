import { ConcertLogItem, Raga } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, moderatorProcedure, protectedProcedure, publicProcedure } from '../trpc';

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

  create: protectedProcedure.input(Raga.CreateRagaSchema).mutation(async ({ input }) => {
    const result = await Raga.createRaga(input);
    triggerReindex();
    return result;
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: Raga.UpdateRagaSchema }))
    .mutation(async ({ input }) => {
      const result = await Raga.updateRaga(input.id, input.data);
      triggerReindex();
      return result;
    }),

  delete: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
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

  listPerformances: publicProcedure
    .input(
      z.object({
        ragaId: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      ConcertLogItem.listPerformancesByRaga(input.ragaId, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),

  getRepertoireStats: publicProcedure
    .input(z.object({ ragaId: z.string().min(1) }))
    .query(async ({ input }) => {
      const raga = await Raga.getRaga(input.ragaId);
      if (!raga) return null;

      const { items } = await ConcertLogItem.listPerformancesByRaga(input.ragaId, { limit: 50 });

      // Count compositions and event contexts
      const compositionCounts = new Map<string, { title: string; count: number }>();
      for (const item of items) {
        if (item.compositionId) {
          const entry = compositionCounts.get(item.compositionId);
          if (entry) {
            entry.count++;
          } else {
            compositionCounts.set(item.compositionId, { title: item.compositionTitle, count: 1 });
          }
        }
      }

      const topCompositions = [...compositionCounts.entries()]
        .map(([id, { title, count }]) => ({ id, title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        raga,
        performanceCount: raga.performanceCount ?? 0,
        topCompositions,
      };
    }),
});
