import { Composition } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

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

  create: publicProcedure
    .input(Composition.CreateCompositionSchema)
    .mutation(({ input }) => Composition.createComposition(input)),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Composition.UpdateCompositionSchema }))
    .mutation(({ input }) => Composition.updateComposition(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => Composition.deleteComposition(input.id)),

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
});
