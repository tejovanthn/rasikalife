import { User } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { SetWhatsappSchema } from '@rasika/core/domain/user/client';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';

/**
 * Notification routes. Phase 3 holds only the WhatsApp number calls the confirmation screen
 * makes. Phase 5 adds the preference and push procedures to this file.
 *
 * Nothing is sent to a stored number in v1. The number stays unverified.
 */
export const notifyRouter = createTRPCRouter({
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

  dismissWhatsappPrompt: protectedProcedure.mutation(async ({ ctx }) => {
    await User.dismissWhatsappPrompt(ctx.user.id);
    return { dismissed: true as const };
  }),
});
