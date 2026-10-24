import { ShortLink } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const shortLinkRouter = createTRPCRouter({
  /**
   * Codes for the links in a WhatsApp text, created where missing. Public, because the text is
   * built for signed-out readers too. Safe to leave open because a target can only be a path
   * on this site with known query keys (`isShortLinkTarget`): nobody can mint a short link to
   * anywhere a direct link could not already reach.
   */
  ensure: publicProcedure
    .input(z.object({ targets: z.array(z.string().max(512)).max(40) }))
    .mutation(async ({ input }) => {
      const codes = await ShortLink.ensureShortLinks(input.targets);
      return Object.fromEntries(codes);
    }),

  resolve: publicProcedure
    .input(z.object({ code: z.string().max(16) }))
    .query(({ input }) => ShortLink.resolveShortLink(input.code)),
});
