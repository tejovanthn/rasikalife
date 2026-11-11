import { Notification, User } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { NotifyPrefsSchema, SetWhatsappSchema } from '@rasika/core/domain/user/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

/**
 * The HMAC key for unsubscribe links. Refuse to run without it: an empty key would let anyone
 * forge a link for any user.
 */
const secret = () => {
  const value = process.env.UNSUBSCRIBE_SECRET;
  if (!value) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'UNSUBSCRIBE_SECRET is not set',
    });
  }
  return value;
};

/**
 * Notification settings, the WhatsApp number, and the signed-out unsubscribe link.
 *
 * `notify` is in `PRIVATE_ROUTERS` (`middleware/site-cache.ts`): none of it changes a public
 * page. Nothing is sent to a stored WhatsApp number in v1; it stays unverified.
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

  setWhatsapp: protectedProcedure.input(SetWhatsappSchema).mutation(async ({ input, ctx }) => {
    try {
      await User.setWhatsapp(ctx.user.id, input);
    } catch (error) {
      if (error instanceof ApplicationError && error.code === ErrorCode.WHATSAPP_INVALID_NUMBER) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message, cause: error });
      }
      throw error;
    }
    return { saved: true as const };
  }),

  removeWhatsapp: protectedProcedure.mutation(async ({ ctx }) => {
    await User.removeWhatsapp(ctx.user.id);
    return { ok: true as const };
  }),

  dismissWhatsappPrompt: protectedProcedure.mutation(async ({ ctx }) => {
    await User.dismissWhatsappPrompt(ctx.user.id);
    return { dismissed: true as const };
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
