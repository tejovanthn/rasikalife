import { ArtistAward, Award } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, editorProcedure, publicProcedure } from '../trpc';

export const awardRouter = createTRPCRouter({
  list: publicProcedure.query(() => Award.listAwards()),

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Award.getAward(input.id)),

  create: editorProcedure
    .input(Award.CreateAwardSchema)
    .mutation(({ input }) => Award.createAward(input)),

  update: editorProcedure
    .input(z.object({ id: z.string().min(1), data: Award.UpdateAwardSchema }))
    .mutation(({ input }) => Award.updateAward(input.id, input.data)),

  delete: editorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => Award.softDeleteAward(input.id)),

  getRecipients: publicProcedure
    .input(z.object({ awardId: z.string().min(1) }))
    .query(({ input }) => ArtistAward.getAwardRecipients(input.awardId)),

  listByOrganiser: publicProcedure
    .input(z.object({ organiserId: z.string().min(1) }))
    .query(({ input }) => Award.listAwardsByOrganiser(input.organiserId)),
});
