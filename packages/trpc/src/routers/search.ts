// packages/trpc/src/routers/search.ts

import { Search } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const searchRouter = createTRPCRouter({
  search: publicProcedure.input(Search.SearchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: input.filters,
      limit: input.limit,
      offset: input.offset,
    })
  ),

  searchWithFullData: publicProcedure.input(Search.SearchInputSchema).query(({ input }) =>
    Search.searchWithFullData(input.query, {
      filters: input.filters,
      limit: input.limit,
      offset: input.offset,
    })
  ),

  health: publicProcedure.query(() => Search.getHealth()),

  /** Get all indexed documents - useful for sitemap generation */
  documents: publicProcedure
    .input(
      z
        .object({
          type: z.enum(['artist', 'raga', 'tala', 'composition']),
          startsWith: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Search.getDocuments(input?.type, input?.startsWith)),
});
