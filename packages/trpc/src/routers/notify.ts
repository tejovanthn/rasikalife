import { Notification, User } from '@rasika/core';
import { NotifyPrefsSchema } from '@rasika/core/domain/user/client';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

const secret = () => process.env.UNSUBSCRIBE_SECRET ?? '';

/**
 * Notification settings and the signed-out unsubscribe link.
 *
 * `notify` is in `PRIVATE_ROUTERS` (`middleware/site-cache.ts`): none of it changes a public
 * page. This file holds phase 5's procedures only. `setWhatsapp` and `dismissWhatsappPrompt`
 * belong to phase 3's file; the two are merged by the orchestrator.
 */
export const notifyRouter = createTRPCRouter({
  /** The four toggles and the WhatsApp row. The number is the user's own, so it is returned. */
  getPrefs: protectedProcedure.query(async ({ ctx }) => {
    const user = await User.getUser(ctx.user.id);
    return {
      ...User.effectiveNotifyPrefs(user ?? {}),
      whatsapp: user?.whatsappNumber
        ? { number: user.whatsappNumber, verified: Boolean(user.whatsappVerifiedAt) }
        : null,
    };
  }),

  setPrefs: protectedProcedure
    .input(NotifyPrefsSchema)
    // TODO(phase 7): `notifyPush` only records the choice. Phase 7 asks the browser for
    // permission and registers the subscription.
    .mutation(({ input, ctx }) => User.setNotifyPrefs(ctx.user.id, input)),

  removeWhatsapp: protectedProcedure.mutation(async ({ ctx }) => {
    await User.removeWhatsapp(ctx.user.id);
    return { ok: true as const };
  }),

  /**
   * Public: the link works from an inbox, signed out. Reads only, so a link scanner that
   * fetches the page changes nothing. Null for a bad, edited or already used link.
   */
  checkUnsubscribe: publicProcedure
    .input(z.object({ token: z.string().min(1).max(512) }))
    .query(async ({ input }) => {
      const checked = await Notification.checkUnsubscribeToken(input.token, secret());
      return checked ? { kind: checked.kind } : null;
    }),

  /** Public. Turns the thing off and rotates the stored token, so the link is used once. */
  unsubscribe: publicProcedure
    .input(z.object({ token: z.string().min(1).max(512) }))
    .mutation(async ({ input }) => Notification.unsubscribeWithToken(input.token, secret())),
});
