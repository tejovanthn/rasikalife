import { Content } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const contentRouter = createTRPCRouter({
  byPath: publicProcedure.input(z.object({ path: z.string() })).query(async ({ input }) => {
    const content = await Content.getContentByPath(input.path);
    if (!content) {
      return { data: null };
    }

    return { data: content };
  }),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Content.listContents(input)),

  allPaths: publicProcedure.query(async () => {
    // Use the optimized query method instead of scan
    const result = await Content.listPublishedContents({ limit: 1000 });

    return {
      data: result.items.map(item => ({
        path: item.path,
        updatedAt: item.updatedAt,
      })),
    };
  }),
});
