import { Festival } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

export const festivalRouter = createTRPCRouter({
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const festival = await Festival.getFestival(input.id);
    if (!festival || festival.status !== 'approved') {
      throw new Error('Festival not found');
    }
    return festival;
  }),

  getDraft: editorProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const festival = await Festival.getFestival(input.id);
    if (!festival) {
      throw new Error('Draft festival not found');
    }
    return festival;
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
    .query(({ input }) => Festival.listFestivals(input)),

  listUpcoming: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Festival.listUpcomingFestivals(input)),

  listByMonth: publicProcedure
    .input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(({ input }) => Festival.listApprovedFestivalsByMonth(input.yearMonth)),

  updatePoster: moderatorProcedure
    .input(
      z.object({
        id: z.string().min(1),
        posterUrl: z.string().url(),
        posterUploadId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return Festival.updateFestival(input.id, {
        posterUrl: input.posterUrl,
        posterUploadId: input.posterUploadId,
      });
    }),
});
