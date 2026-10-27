import { Source } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

/** Read-only: sources are written through the admin CSV (`/admin/data/source`). */
export const sourceRouter = createTRPCRouter({
  list: publicProcedure.query(() => Source.listAllSources()),

  bySlugs: publicProcedure
    .input(z.object({ slugs: z.array(Source.SourceSlugSchema).max(100) }))
    .query(({ input }) => Source.getSources(input.slugs)),
});
