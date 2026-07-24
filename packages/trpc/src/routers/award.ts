import { ArtistAward, Award } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

export const awardRouter = createTRPCRouter({
  // The award picker's create-path: resolve a typed name to an award, creating
  // one only on a miss. Awards are a small curated set with no near-duplicate
  // problem, so an exact-name lookup is enough — no fuzzy dedup like artists.
  resolveOrCreate: moderatorProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const name = input.name.trim();
      const existing = await Award.getAwardByName(name);
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

  // Live DB search for the moderator find-or-create picker (SearchSelect),
  // mirroring Artist.searchLive: the S3 Fuse index refreshes on a 5-minute
  // throttle, so an award created moments ago wouldn't be findable there yet.
  //
  // Award has no fuzzy-matching helper analogous to artist/dedup.ts, and no
  // secondary index beyond exact name (`byName`) — inventing either is out of
  // scope here. Awards are also a small, hand-curated list rather than an
  // open-ended, scraped one like artists, so pulling them all via listAwards
  // and filtering in memory is the simplest correct approach.
  searchLive: publicProcedure
    .input(z.object({ query: z.string(), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const query = input.query.trim();
      if (!query) return [];
      const limit = input.limit ?? 10;
      const normalizedQuery = query.toLowerCase();

      // getAwardByName, unlike Artist.getArtistByName, doesn't filter
      // deletedAt/mergedIntoId — replicate that guard here so a soft-deleted or
      // merged-away award can't surface, consistent with the artist endpoint.
      const rawExact = await Award.getAwardByName(query);
      let exact: Award.Award | null = null;
      if (rawExact?.deletedAt) {
        exact = rawExact.mergedIntoId ? await Award.getAward(rawExact.mergedIntoId) : null;
      } else {
        exact = rawExact;
      }

      const all = await Award.listAwards();
      const matches = all
        .filter(
          award => award.id !== exact?.id && award.name.toLowerCase().includes(normalizedQuery)
        )
        .sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStarts = aName.startsWith(normalizedQuery) ? 0 : 1;
          const bStarts = bName.startsWith(normalizedQuery) ? 0 : 1;
          return aStarts - bStarts || a.name.length - b.name.length;
        });

      const results = exact ? [exact, ...matches] : matches;
      return results.slice(0, limit).map(award => ({ id: award.id, name: award.name }));
    }),

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
