import { Artist, ArtistClaim, Auth } from '@rasika/core';
import type { Role } from '@rasika/core/auth';
import { ROLE } from '@rasika/core/auth';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, moderatorProcedure, protectedProcedure, publicProcedure } from '../trpc';

const MODERATOR_ROLES: Role[] = [ROLE.MODERATOR, ROLE.ADMIN];

// ElectroDB surfaces a failed `attribute_not_exists` guard as the underlying DynamoDB error.
// Matching it is what lets a genuine duplicate be told apart from a throttle or a permission
// failure, which must not be reported to the user as "you already did this".
function isConditionalCheckFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: string; code?: string }).name;
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : '';
  return (
    name === 'ConditionalCheckFailedException' ||
    code === 'ConditionalCheckFailedException' ||
    message.includes('ConditionalCheckFailed') ||
    message.includes('exists')
  );
}

export const artistClaimRouter = createTRPCRouter({
  /**
   * A signed-in user claiming an artist profile (§8). The claimant's identity comes from the
   * session, never the input — accepting a userId here would let anyone file a claim in
   * someone else's name, and that row is what `canManageArtist` later trusts.
   */
  create: protectedProcedure
    .input(z.object({ artistId: z.string().min(1), note: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist || artist.deletedAt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }

      try {
        return await ArtistClaim.createArtistClaim({
          artistId: input.artistId,
          artistName: artist.name,
          userId: ctx.user.id,
          userName: ctx.user.name,
          userEmail: ctx.user.email,
          note: input.note,
        });
      } catch (error) {
        // Only the duplicate is a CONFLICT. Mapping every failure to it told a user whose
        // write had actually failed that they had already claimed the artist, so they stopped
        // retrying something that had never succeeded.
        if (isConditionalCheckFailure(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You have already claimed this artist',
          });
        }
        throw error;
      }
    }),

  /**
   * The signed-in user's own claim on one artist, for the profile's claim affordance.
   *
   * Scoped to one artist and narrowed to the status: the full row carries the moderator's
   * private reasoning about the claimant, and the tRPC function URL is public, so a rejected
   * claimant could otherwise read what was written about them. A GetItem also beats the GSI
   * query this replaced, which was eventually consistent enough to show the claim button again
   * right after a successful claim.
   */
  myStatusFor: protectedProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const claim = await ArtistClaim.getClaimForUser(input.artistId, ctx.user.id);
      return claim ? { status: claim.status } : null;
    }),

  /**
   * Whether the signed-in user may manage this artist. Public rather than protected so an
   * anonymous viewer gets a plain `false` instead of an error the profile loader has to catch.
   */
  canManage: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ ctx, input }) => {
      if (!ctx.user) return false;
      // A moderator can already manage every artist, so short-circuit rather than making
      // them hold a claim on each one. canManageArtist deliberately answers only the
      // per-artist half of the question — see its doc comment.
      if (MODERATOR_ROLES.includes(ctx.user.role as Role)) return true;
      return ArtistClaim.canManageArtist(ctx.user.id, input.artistId);
    }),

  /**
   * A moderator pre-authorizing the artist's own email during enrichment (§4.3.1) — the
   * path that skips the queue entirely, since the moderator is already corresponding with
   * the artist and has established identity out of band.
   */
  invite: moderatorProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        email: z.string().email(),
        // Required: this grant skips the queue entirely, so the note is the only record
        // of how the moderator knew the address belonged to the artist.
        moderatorNote: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist || artist.deletedAt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }

      try {
        return await ArtistClaim.createArtistClaimInvite({
          artistId: input.artistId,
          artistName: artist.name,
          email: input.email,
          moderatorId: ctx.user.id,
          moderatorNote: input.moderatorNote,
        });
      } catch (error) {
        if (isConditionalCheckFailure(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'That email has already been invited to this artist',
          });
        }
        throw error;
      }
    }),

  /** Outstanding invites, so a moderator can see and withdraw what has been handed out. */
  invited: moderatorProcedure
    .input(
      z
        .object({ limit: z.number().min(1).max(100).optional(), nextToken: z.string().optional() })
        .optional()
    )
    .query(({ input }) => ArtistClaim.getInvitedClaims(input)),

  /**
   * Withdraws an unredeemed invite. Without this a mistyped address is a standing offer of
   * someone else's profile, redeemable at any future login and removable only by hand.
   */
  revokeInvite: moderatorProcedure
    .input(z.object({ artistId: z.string().min(1), email: z.string().email() }))
    .mutation(async ({ input }) => {
      await ArtistClaim.revokeArtistClaimInvite(input.artistId, input.email);
      return { success: true as const };
    }),

  /** Every claim and invite on one artist — the moderator's view of a single profile. */
  listForArtist: moderatorProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ input }) => ArtistClaim.getArtistClaims(input.artistId)),

  /** The claims queue feed (§4.3), deliberately separate from the Edit/Event queues. */
  pending: moderatorProcedure
    .input(
      z
        .object({ limit: z.number().min(1).max(100).optional(), nextToken: z.string().optional() })
        .optional()
    )
    .query(({ input }) => ArtistClaim.getPendingClaims(input)),

  approve: moderatorProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        userId: z.string().min(1),
        // Required, not optional: §8 makes this the audit trail for an identity check that
        // happened off the record entirely, so an approval without it leaves no trace of why.
        moderatorNote: z.string().min(1).max(2000),
      })
    )
    .mutation(({ ctx, input }) =>
      ArtistClaim.approveClaim(input.artistId, input.userId, ctx.user.id, input.moderatorNote)
    ),

  reject: moderatorProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        userId: z.string().min(1),
        moderatorNote: z.string().min(1).max(2000),
      })
    )
    .mutation(({ ctx, input }) =>
      ArtistClaim.rejectClaim(input.artistId, input.userId, ctx.user.id, input.moderatorNote)
    ),
});
