import {
  Organiser,
  PartnerInvite,
  PartnerMember,
  Sabha,
  User,
  Venue,
  VenueQr,
  VenueSpace,
} from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import {
  InvitePartnerSchema,
  RevokePartnerSchema,
} from '@rasika/core/domain/partner-member/client';
import { invalidateSiteCache } from '@rasika/core/site-cache';
import { TRPCError } from '@trpc/server';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';
import { z } from 'zod';
import { sendPartnerInviteEmail } from '../partner-invite-email';
import { triggerReindex } from '../reindex';
import {
  createTRPCRouter,
  moderatorProcedure,
  partnerOwnerProcedure,
  partnerProcedure,
  partnerStrictOwnerProcedure,
  protectedProcedure,
} from '../trpc';

const CODE_BY_ERROR: Partial<Record<ErrorCode, TRPC_ERROR_CODE_KEY>> = {
  [ErrorCode.PARTNER_FORBIDDEN]: 'FORBIDDEN',
  [ErrorCode.PARTNER_INVITE_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.PARTNER_INVITE_EXPIRED]: 'BAD_REQUEST',
  [ErrorCode.PARTNER_INVITE_EMAIL_MISMATCH]: 'BAD_REQUEST',
  [ErrorCode.VENUE_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.ORGANISER_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.EVENT_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.SPACE_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.VALIDATION_ERROR]: 'BAD_REQUEST',
};

/** Core's `ApplicationError` becomes a `TRPCError` that keeps it as `cause`, like the others. */
export function toPartnerTrpcError(error: unknown): unknown {
  if (error instanceof ApplicationError) {
    return new TRPCError({
      code: CODE_BY_ERROR[error.code as ErrorCode] ?? 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    });
  }
  return error;
}

export async function mapPartnerErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toPartnerTrpcError(error);
  }
}

const TargetSchema = z.object({
  targetType: z.enum(['organiser', 'venue']),
  targetId: z.string().min(1),
});

/** The owner's event form, plus the target the call is gated on. */
const SaveEventSchema = TargetSchema.extend({
  title: z.string().trim().min(1).max(300),
  date: VenueQr.CalendarDateSchema,
  startTime: VenueQr.ClockTimeSchema,
  venueId: z.string().optional(),
  spaceId: z.string().optional(),
  artists: z.string().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** What the Events screen and the moderator feed need; no internal fields. */
function toEventView(event: {
  id: string;
  title: string;
  status: string;
  startDateTime: string;
  endDateTime?: string | null;
  timezone: string;
  venueId?: string | null;
  venueName?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  organiserId?: string | null;
  organiserName?: string | null;
  description?: string | null;
  artists?: Array<{ name: string }> | null;
  ownerPublishedAt?: string | null;
}) {
  return {
    id: event.id,
    title: event.title,
    status: event.status,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime ?? undefined,
    timezone: event.timezone,
    venueId: event.venueId ?? undefined,
    venueName: event.venueName ?? undefined,
    spaceId: event.spaceId ?? undefined,
    spaceName: event.spaceName ?? undefined,
    organiserId: event.organiserId ?? undefined,
    organiserName: event.organiserName ?? undefined,
    description: event.description ?? undefined,
    artists: (event.artists ?? []).map(artist => artist.name),
    ownerPublishedAt: event.ownerPublishedAt ?? undefined,
  };
}

function requireOrganiserTarget(targetType: string, targetId: string): string {
  if (targetType !== 'organiser') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Concerts are added for an organiser',
    });
  }
  return targetId;
}

/**
 * Sabha dashboard routes.
 *
 * Access: `invite`, `revoke`, `members`, `setEventReview` and `ownerPublishedEvents` are for
 * moderators. `mine`, `pendingInvites` and `acceptInvite` are for any signed-in user (they are about the caller's
 * own grants). `teamForTarget` is for members; `inviteViewer`, `revokeViewer` and `withdrawInvite`
 * are for a real owner (`partnerStrictOwnerProcedure`), and only ever touch viewers. Every other route names a `targetType` and `targetId` and goes through
 * `partnerProcedure` (member or moderator), `partnerOwnerProcedure` (owner or moderator) or
 * `partnerStrictOwnerProcedure` (owner only: the export and the profile edit).
 *
 * Cache: `partner` is a public router, so a mutation clears the page cache, and that is right
 * for `updateProfile`, `createEvent`, `updateEvent` and `setEventReview`, which change what a
 * public page shows. `invite`, `revoke`, `inviteViewer`, `revokeViewer`, `withdrawInvite`,
 * `exportFollowers` and `acceptInvite` are in `PRIVATE_PATHS`. `acceptInvite` clears it itself when it set `verifiedAt`, since that is
 * what turns the Verified badge on.
 */
export const partnerRouter = createTRPCRouter({
  invite: moderatorProcedure.input(InvitePartnerSchema).mutation(({ ctx, input }) =>
    mapPartnerErrors(async () => {
      const invite = await PartnerInvite.createPartnerInvite({
        ...input,
        invitedBy: ctx.user.id,
      });
      const target = await Sabha.getPartnerTarget(input.targetType, input.targetId);
      const emailSent = await sendPartnerInviteEmail({
        to: invite.email,
        inviterName: ctx.user.name,
        targetName: target?.name ?? '',
      });
      return { email: invite.email, role: invite.role, expiresAt: invite.expiresAt, emailSent };
    })
  ),

  revoke: moderatorProcedure.input(RevokePartnerSchema).mutation(({ input }) =>
    mapPartnerErrors(async () => {
      const removed = await PartnerMember.revokePartnerMember(
        input.userId,
        input.targetType,
        input.targetId
      );
      return { removed };
    })
  ),

  /** Members of one target, with their names, for the admin page. */
  members: moderatorProcedure.input(TargetSchema).query(({ input }) =>
    mapPartnerErrors(async () => {
      const members = await PartnerMember.listPartnerMembers(input.targetType, input.targetId);
      const users = await Promise.all(members.map(member => User.getUser(member.userId)));
      const target = await Sabha.getPartnerTarget(input.targetType, input.targetId);
      return {
        targetName: target?.name ?? null,
        verifiedAt: target?.verifiedAt ?? null,
        requireEventReview: target?.requireEventReview === true,
        members: members.map((member, i) => ({
          userId: member.userId,
          name: users[i]?.name ?? null,
          email: users[i]?.email ?? null,
          role: member.role,
          createdAt: member.createdAt,
        })),
      };
    })
  ),

  /** The dashboards the caller can open, for the switcher. */
  mine: protectedProcedure.query(({ ctx }) =>
    mapPartnerErrors(async () => {
      const grants = await PartnerMember.listPartnerTargetsForUser(ctx.user.id);
      return grants
        .map(grant => ({
          targetType: grant.targetType,
          targetId: grant.targetId,
          targetName: grant.targetName,
          role: grant.role,
        }))
        .sort((a, b) => a.targetName.localeCompare(b.targetName));
    })
  ),

  /**
   * The caller's invites, found by their email. Nothing is accepted here or on sign-in: an
   * invite takes effect only through `acceptInvite` (owner decision 20). `expired` are returned
   * so the page can say so. The inviter's name is shown when that user still exists.
   */
  pendingInvites: protectedProcedure.query(({ ctx }) =>
    mapPartnerErrors(async () => {
      const { pending, expired } = await PartnerInvite.listInvitesForUser({
        email: ctx.user.email,
      });
      const inviterName = async (userId: string) => (await User.getUser(userId))?.name ?? null;
      return {
        pending: await Promise.all(
          pending.map(async invite => ({
            targetType: invite.targetType,
            targetId: invite.targetId,
            targetName: invite.targetName,
            role: invite.role,
            expiresAt: invite.expiresAt,
            inviterName: await inviterName(invite.invitedBy),
          }))
        ),
        expired: expired.map(invite => ({
          targetType: invite.targetType,
          targetId: invite.targetId,
          targetName: invite.targetName,
        })),
      };
    })
  ),

  /**
   * Accepts one invite for the caller. Clears the page cache only when this accept set
   * `verifiedAt` (the Verified badge is on cached public pages); otherwise it is in
   * `PRIVATE_PATHS`.
   */
  acceptInvite: protectedProcedure.input(TargetSchema).mutation(({ ctx, input }) =>
    mapPartnerErrors(async () => {
      const { member, verified } = await PartnerInvite.acceptInviteForUser(
        { id: ctx.user.id, email: ctx.user.email },
        input
      );
      if (verified) await invalidateSiteCache('partner.acceptInvite');
      return {
        targetType: member.targetType,
        targetId: member.targetId,
        targetName: member.targetName,
        role: member.role,
      };
    })
  ),

  /**
   * The Team tab: members with names and emails, and the invites still waiting (unaccepted,
   * unexpired). Any member may read it; only an owner may change it (below). A moderator reads
   * it too, and changes people in the admin app.
   */
  teamForTarget: partnerProcedure.input(TargetSchema).query(({ ctx, input }) =>
    mapPartnerErrors(async () => {
      const [members, invites] = await Promise.all([
        PartnerMember.listPartnerMembers(input.targetType, input.targetId),
        PartnerInvite.listPendingInvitesForTarget(input.targetType, input.targetId),
      ]);
      const users = await Promise.all(members.map(member => User.getUser(member.userId)));
      return {
        role: ctx.partner.role,
        selfUserId: ctx.user.id,
        members: members.map((member, i) => ({
          userId: member.userId,
          name: users[i]?.name ?? null,
          email: users[i]?.email ?? null,
          role: member.role,
        })),
        invites: invites.map(invite => ({
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
        })),
      };
    })
  ),

  /**
   * An owner invites a viewer by email, with the same 14 day invite and email as a moderator's.
   * Never an owner: owners are made by moderators, since the first one turns on the Verified
   * badge. A moderator is not admitted here (strict owner); they use the admin app.
   */
  inviteViewer: partnerStrictOwnerProcedure
    .input(TargetSchema.extend({ email: z.string().trim().email() }))
    .mutation(({ ctx, input }) =>
      mapPartnerErrors(async () => {
        const invite = await PartnerInvite.inviteViewer({
          targetType: input.targetType,
          targetId: input.targetId,
          email: input.email,
          invitedBy: ctx.user.id,
        });
        const target = await Sabha.getPartnerTarget(input.targetType, input.targetId);
        const emailSent = await sendPartnerInviteEmail({
          to: invite.email,
          inviterName: ctx.user.name,
          targetName: target?.name ?? '',
        });
        return { email: invite.email, role: invite.role, expiresAt: invite.expiresAt, emailSent };
      })
    ),

  /** An owner removes a viewer of this target. Not an owner, not themselves. */
  revokeViewer: partnerStrictOwnerProcedure
    .input(TargetSchema.extend({ userId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      mapPartnerErrors(async () => ({
        removed: await PartnerMember.revokeViewerMember(
          ctx.user.id,
          input.userId,
          input.targetType,
          input.targetId
        ),
      }))
    ),

  /** An owner withdraws a viewer invite that has not been accepted. */
  withdrawInvite: partnerStrictOwnerProcedure
    .input(TargetSchema.extend({ email: z.string().trim().email() }))
    .mutation(({ input }) =>
      mapPartnerErrors(async () => {
        await PartnerInvite.withdrawPartnerInvite(input.email, input.targetType, input.targetId);
        return { withdrawn: true };
      })
    ),

  overview: partnerProcedure.input(TargetSchema).query(({ ctx, input }) =>
    mapPartnerErrors(async () => ({
      ...(await Sabha.getPartnerOverview(input.targetType, input.targetId)),
      role: ctx.partner.role,
    }))
  ),

  /** The record behind the Profile screen. Public data, so any member may read it. */
  profile: partnerProcedure.input(TargetSchema).query(({ ctx, input }) =>
    mapPartnerErrors(async () => {
      const record =
        input.targetType === 'organiser'
          ? await Organiser.getOrganiser(input.targetId)
          : await Venue.getVenue(input.targetId);
      if (!record) {
        throw new ApplicationError(
          input.targetType === 'venue' ? ErrorCode.VENUE_NOT_FOUND : ErrorCode.ORGANISER_NOT_FOUND,
          `${input.targetType} ${input.targetId} not found`
        );
      }
      return { role: ctx.partner.role, record };
    })
  ),

  updateProfile: partnerStrictOwnerProcedure
    .input(
      TargetSchema.extend({
        input: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(({ ctx, input }) =>
      mapPartnerErrors(async () => {
        const result = await Sabha.updatePartnerProfile({
          targetType: input.targetType,
          targetId: input.targetId,
          userId: ctx.user.id,
          changes: input.input,
        });
        if (result.changed.length > 0) triggerReindex();
        return result;
      })
    ),

  /** Upcoming and past events of the organiser, or at the venue. */
  events: partnerProcedure.input(TargetSchema).query(({ input }) =>
    mapPartnerErrors(async () => {
      const { upcoming, past } = await Sabha.listTargetEvents(input.targetType, input.targetId);
      return { upcoming: upcoming.map(toEventView), past: past.map(toEventView) };
    })
  ),

  /**
   * Halls of any venue, for the event form's Space list. An organiser's owner is not a member of
   * the hall they hire, so `space.list` would refuse; the names of halls are on public event
   * pages already, so any member of the dashboard may read them here.
   */
  spacesForVenue: partnerProcedure
    .input(TargetSchema.extend({ venueId: z.string().min(1) }))
    .query(({ input }) =>
      mapPartnerErrors(async () =>
        (await VenueSpace.listSpaces(input.venueId)).map(space => ({
          spaceId: space.spaceId,
          name: space.name,
        }))
      )
    ),

  createEvent: partnerOwnerProcedure.input(SaveEventSchema).mutation(({ ctx, input }) =>
    mapPartnerErrors(async () => {
      const organiserId = requireOrganiserTarget(input.targetType, input.targetId);
      const result = await Sabha.createOwnerEvent({ ...input, organiserId }, ctx.user.id);
      if (result.published) triggerReindex();
      return result;
    })
  ),

  updateEvent: partnerOwnerProcedure
    .input(SaveEventSchema.extend({ eventId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      mapPartnerErrors(async () => {
        const organiserId = requireOrganiserTarget(input.targetType, input.targetId);
        const { event, sentToReview } = await Sabha.updateOwnerEvent(
          { ...input, organiserId },
          ctx.user.id
        );
        // Nothing changed on the live event when the edit went to review.
        if (!sentToReview) triggerReindex();
        return { ...toEventView(event), sentToReview };
      })
    ),

  /** A CSV of followers who chose to share with this target. Owners only, never a moderator. */
  exportFollowers: partnerStrictOwnerProcedure.input(TargetSchema).mutation(({ ctx, input }) =>
    mapPartnerErrors(() =>
      Sabha.exportFollowers({
        targetType: input.targetType,
        targetId: input.targetId,
        userId: ctx.user.id,
      })
    )
  ),

  /** Moderators only: turn review of an organiser's owner events on or off. */
  setEventReview: moderatorProcedure
    .input(z.object({ organiserId: z.string().min(1), require: z.boolean() }))
    .mutation(({ input }) =>
      mapPartnerErrors(() => Sabha.setOrganiserEventReview(input.organiserId, input.require))
    ),

  /** Moderator spot-check feed: events owners published without review. */
  ownerPublishedEvents: moderatorProcedure.query(() =>
    mapPartnerErrors(async () => (await Sabha.listOwnerPublishedEvents()).map(toEventView))
  ),
});
