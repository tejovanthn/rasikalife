import { Follow } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import {
  BulkSetFollowSchema,
  FollowStatusSchema,
  SetShareSchema,
  ToggleFollowSchema,
} from '@rasika/core/domain/follow/client';
import { TRPCError } from '@trpc/server';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';

const CODE_BY_ERROR: Partial<Record<ErrorCode, TRPC_ERROR_CODE_KEY>> = {
  [ErrorCode.FOLLOW_TARGET_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.FOLLOW_SHARE_NOT_ALLOWED]: 'BAD_REQUEST',
  [ErrorCode.QR_NOT_FOUND]: 'NOT_FOUND',
};

/** Core's `ApplicationError` becomes a `TRPCError` that keeps it as `cause`, like the others. */
export function toTrpcError(error: unknown): unknown {
  if (error instanceof ApplicationError) {
    return new TRPCError({
      code: CODE_BY_ERROR[error.code as ErrorCode] ?? 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    });
  }
  return error;
}

async function mapErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toTrpcError(error);
  }
}

/** What `/me/following` and the entity pages need; never another user's data. */
export function toMyFollow(row: Follow.Follow) {
  return {
    targetType: row.targetType,
    targetId: row.targetId,
    targetName: row.targetName,
    shareWithTarget: row.shareWithTarget === true,
    createdAt: row.createdAt,
  };
}

/**
 * Follow routes. All are `protectedProcedure`: a signed-out reader goes through sign-in first
 * (the web app turns `?follow=1` into a call here on return).
 *
 * Cache: `toggle`, `bulkSet` and `setShare` are listed in `PRIVATE_PATHS`
 * (`middleware/site-cache.ts`) and never clear the site cache, so a burst of QR follows cannot
 * purge the CDN once per follower. The public `followerCount` on a cached page can lag until the
 * next clear (at most a week).
 */
export const followRouter = createTRPCRouter({
  bulkSet: protectedProcedure
    .input(BulkSetFollowSchema)
    // `bulkSetFollows` also adds the new follows to the code's `followCount` and the day's
    // `QrScanDay.follows` when `qrCode` is given.
    .mutation(({ input, ctx }) => mapErrors(() => Follow.bulkSetFollows(ctx.user.id, input))),

  toggle: protectedProcedure.input(ToggleFollowSchema).mutation(({ input, ctx }) =>
    mapErrors(async () => {
      const existing = await Follow.getFollow(ctx.user.id, input.type, input.id);
      if (existing) {
        await Follow.unfollowTarget(ctx.user.id, input.type, input.id);
        return { following: false };
      }
      await Follow.followTarget({
        userId: ctx.user.id,
        targetType: input.type,
        targetId: input.id,
      });
      return { following: true };
    })
  ),

  status: protectedProcedure.input(FollowStatusSchema).query(({ input, ctx }) =>
    mapErrors(async () => {
      const rows = await Follow.getFollowStatus(ctx.user.id, input.targets);
      return Object.fromEntries(
        Object.entries(rows).map(([key, row]) => [
          key,
          { following: row !== null, share: row?.shareWithTarget === true },
        ])
      );
    })
  ),

  mine: protectedProcedure.query(({ ctx }) =>
    mapErrors(async () => (await Follow.listMyFollows(ctx.user.id)).map(toMyFollow))
  ),

  setShare: protectedProcedure.input(SetShareSchema).mutation(({ input, ctx }) =>
    mapErrors(async () => {
      const row = await Follow.setFollowShare({
        userId: ctx.user.id,
        targetType: input.type,
        targetId: input.id,
        share: input.share,
      });
      return toMyFollow(row);
    })
  ),
});
