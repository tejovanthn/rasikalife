import { Raga } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

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
    .mutation(({ input }) => Raga.createRaga(input)),

  update: publicProcedure
    .input(z.object({ id: z.string().min(1), data: Raga.UpdateRagaSchema }))
    .mutation(({ input }) => Raga.updateRaga(input.id, input.data)),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => Raga.deleteRaga(input.id)),

  getByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Raga.getRagaByName(input.name)),
});
