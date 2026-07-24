import { ArtistAward, Award } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

export const awardRouter = createTRPCRouter({
  // The award picker's create-path: resolve a typed name to an award, creating
  // one only on a miss. The match is case-insensitive over the curated award
  // list — awards are few, so a full scan is fine, and it stops "sangeet
  // kalanidhi" minting a duplicate beside "Sangeet Kalanidhi". No fuzzy dedup
  // beyond case, unlike the scraped, open-ended artist set.
  resolveOrCreate: moderatorProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const name = input.name.trim();
      const normalized = name.toLowerCase();
      const all = await Award.listAwards();
      const existing = all.find(award => award.name.toLowerCase() === normalized);
      if (existing) {
        return { id: existing.id, name: existing.name, created: false };
      }
      const created = await Award.createAward({ name });
      return { id: created.id, name: created.name, created: true };
    }),

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
