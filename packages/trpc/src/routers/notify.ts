import { Notification, PushSubscription, User } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import {
  SubscribePushSchema,
  UnsubscribePushSchema,
} from '@rasika/core/domain/push-subscription/client';
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
    .mutation(({ input, ctx }) => User.setNotifyPrefs(ctx.user.id, input)),

  /**
   * Registers this browser and turns `notifyPush` on. The row is keyed by the endpoint hash, so
   * subscribing twice from one browser replaces the keys and stays one row. A bad endpoint or
   * missing keys is `PUSH_SUBSCRIPTION_INVALID` (BAD_REQUEST).
   */
  subscribePush: protectedProcedure.input(SubscribePushSchema).mutation(async ({ input, ctx }) => {
    try {
      await PushSubscription.putPushSubscription(
        ctx.user.id,
        input,
        ctx.event?.headers?.['user-agent']
      );
    } catch (error) {
      if (error instanceof ApplicationError && error.code === ErrorCode.PUSH_SUBSCRIPTION_INVALID) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message, cause: error });
      }
      throw error;
    }
    await User.setNotifyPrefs(ctx.user.id, { notifyPush: true });
    return { subscribed: true as const };
  }),

  /**
   * Removes this browser. `notifyPush` means "push on my devices", so when the last device goes
   * it is turned off too; otherwise the toggle would read on with nothing to send to. Other
   * devices are untouched. Reminders then go by email.
   */
  unsubscribePush: protectedProcedure
    .input(UnsubscribePushSchema)
    .mutation(async ({ input, ctx }) => {
      await PushSubscription.deletePushSubscription(ctx.user.id, input.endpoint);
      const remaining = await PushSubscription.listPushSubscriptions(ctx.user.id);
      if (remaining.length === 0) await User.setNotifyPrefs(ctx.user.id, { notifyPush: false });
      return { remaining: remaining.length };
    }),

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
