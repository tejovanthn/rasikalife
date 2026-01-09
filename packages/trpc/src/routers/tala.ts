import { Tala } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

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
});
