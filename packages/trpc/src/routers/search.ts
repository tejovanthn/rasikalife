// packages/trpc/src/routers/search.ts

import { Search } from '@rasika/core';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const searchRouter = createTRPCRouter({
  search: publicProcedure.input(Search.SearchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: input.filters,
      limit: input.limit,
      offset: input.offset,
    })
  ),

  health: publicProcedure.query(() => Search.getHealth()),
});
