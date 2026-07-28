import { Artist, ArtistClaim, Auth } from '@rasika/core';
import type { Role } from '@rasika/core/auth';
import { ROLE } from '@rasika/core/auth';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, moderatorProcedure, protectedProcedure, publicProcedure } from '../trpc';

const MODERATOR_ROLES: Role[] = [ROLE.MODERATOR, ROLE.ADMIN];

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
      } catch (_error) {
        // createArtistClaim uses .create(), so a second claim on the same artist by the same
        // user fails the attribute_not_exists condition rather than clobbering the first.
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You have already claimed this artist',
        });
      }
    }),

  /** The signed-in user's own claims, for showing "claim pending" on a profile they claimed. */
  mine: protectedProcedure.query(({ ctx }) => ArtistClaim.getUserClaims(ctx.user.id)),

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
        moderatorNote: z.string().max(2000).optional(),
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
      } catch (_error) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'That email has already been invited to this artist',
        });
      }
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
