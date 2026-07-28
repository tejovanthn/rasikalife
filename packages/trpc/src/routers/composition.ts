import { Composition, ConcertLogItem } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, moderatorProcedure, protectedProcedure, publicProcedure } from '../trpc';

export const compositionRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Composition.getComposition(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Composition.listCompositions(input)),

  create: protectedProcedure
    .input(Composition.CreateCompositionSchema)
    .mutation(async ({ input }) => {
      const result = await Composition.createComposition(input);
      triggerReindex();
      return result;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: Composition.UpdateCompositionSchema }))
    .mutation(async ({ input }) => {
      const result = await Composition.updateComposition(input.id, input.data);
      triggerReindex();
      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Composition.deleteComposition(input.id);
      triggerReindex();
      return result;
    }),

  byComposer: publicProcedure
    .input(
      z.object({
        composerId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      Composition.getCompositionsByComposer(input.composerId, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),

  byRaga: publicProcedure
    .input(
      z.object({
        ragaId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      Composition.getCompositionsByRaga(input.ragaId, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),

  byTala: publicProcedure
    .input(
      z.object({
        talaId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      Composition.getCompositionsByTala(input.talaId, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),

  byName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Composition.getCompositionsByName(input.name)),

  byLanguage: publicProcedure
    .input(
      z.object({
        language: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      Composition.getCompositionsByLanguage(input.language, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Composition.getComposition(input.idA),
        Composition.getComposition(input.idB),
        Composition.getCompositionMergeScore(input.idA),
        Composition.getCompositionMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.title, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.title, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),

  listPerformances: publicProcedure
    .input(
      z.object({
        compositionId: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      ConcertLogItem.listPerformancesByComposition(input.compositionId, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),
});
