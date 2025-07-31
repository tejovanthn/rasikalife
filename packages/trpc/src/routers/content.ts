import { ContentService } from '@rasika/core';
import { z } from 'zod';
import { createRouter, publicProcedure } from '../server';

export const contentRouter = createRouter({
  byPath: publicProcedure.input(z.object({ path: z.string() })).query(async ({ input }) => {
    const content = await ContentService.getByPath(input.path);
    return { data: content };
  }),

  allPaths: publicProcedure.query(async () => {
    // For now, return empty array.
    // TODO: Implement ContentService.getAllPaths() when needed for sitemap generation
    return { data: [] as Array<{ path: string; updatedAt: string }> };
  }),

  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const content = await ContentService.getById(input.id);
    return { data: content };
  }),
});
