import { Organiser } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, editorProcedure, publicProcedure } from '../trpc';

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
});
