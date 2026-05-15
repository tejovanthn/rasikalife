import { ConcertLogItem, EventSetlist } from '@rasika/core';
import { DISPUTE_FIELDS, REJECT_REASONS } from '@rasika/core/domain/concert-log-item/client';
import { z } from 'zod';
import { adminProcedure, createTRPCRouter, moderatorProcedure } from '../trpc';

const paginationSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  nextToken: z.string().optional(),
});

const rejectReasonEnum = z.enum(REJECT_REASONS);

export const setlistModerationRouter = createTRPCRouter({
  listPendingFreeText: moderatorProcedure
    .input(paginationSchema)
    .query(({ input }) => ConcertLogItem.listPendingFreeTextItems(input)),

  linkFreeText: moderatorProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        eventId: z.string().min(1),
        order: z.number().int().min(0),
        compositionId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await ConcertLogItem.linkFreeTextToComposition(
        input.userId,
        input.eventId,
        input.order,
        input.compositionId,
        ctx.user.id
      );
      await EventSetlist.recomputeEventSetlist(input.eventId);
      return item;
    }),

  rejectFreeText: moderatorProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        eventId: z.string().min(1),
        order: z.number().int().min(0),
        reason: rejectReasonEnum,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await ConcertLogItem.rejectFreeTextItem(
        input.userId,
        input.eventId,
        input.order,
        ctx.user.id,
        input.reason
      );
      await EventSetlist.recomputeEventSetlist(input.eventId);
      return item;
    }),

  listDisputes: moderatorProcedure
    .input(paginationSchema)
    .query(({ input }) => EventSetlist.listDisputedSetlistItems(input)),

  resolveDispute: moderatorProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        order: z.number().int().min(0),
        field: z.enum(DISPUTE_FIELDS),
        value: z.string().min(1),
      })
    )
    .mutation(({ input }) =>
      EventSetlist.verifyEventSetlistRow(input.eventId, input.order, {
        [input.field]: input.value,
      })
    ),

  overrideEventSetlist: moderatorProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        order: z.number().int().min(0),
        compositionId: z.string().optional(),
        compositionTitle: z.string().max(500).optional(),
        ragaId: z.string().optional(),
        ragaName: z.string().optional(),
        talaId: z.string().optional(),
        talaName: z.string().optional(),
        compositionType: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { eventId, order, ...updates } = input;
      return EventSetlist.verifyEventSetlistRow(eventId, order, updates);
    }),

  unlockVerifiedRow: adminProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        order: z.number().int().min(0),
      })
    )
    .mutation(({ input }) => EventSetlist.unlockEventSetlistRow(input.eventId, input.order)),

  getStats: moderatorProcedure.query(async () => {
    const [pending, disputes] = await Promise.all([
      ConcertLogItem.listPendingFreeTextItems({ limit: 50 }),
      EventSetlist.listDisputedSetlistItems({ limit: 50 }),
    ]);
    return {
      pendingFreeText: { count: pending.items.length, hasMore: pending.hasMore },
      disputes: { count: disputes.items.length, hasMore: disputes.hasMore },
    };
  }),
});
