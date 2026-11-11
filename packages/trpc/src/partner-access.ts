import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/**
 * Who may open a sabha dashboard, as one pure function so the whole matrix is tested without a
 * table. `partnerProcedure` (trpc.ts) is a thin wrapper that reads the target out of the call's
 * input and passes the real membership lookup.
 *
 * - A member of the target with the role the action needs passes.
 * - A moderator or admin passes too, as `moderator`, unless `allowModerator` is false. The
 *   follower export sets it false: followers consented to share their details with the sabha,
 *   not with the platform's staff, so only a real owner grant opens that file.
 * - Everyone else gets `PARTNER_FORBIDDEN`. The error carries the core `ApplicationError` as its
 *   `cause`, so the client reads `code` (the formatter in trpc.ts copies it).
 */
export type PartnerTargetType = 'organiser' | 'venue';
export type PartnerNeeds = 'viewer' | 'owner';
export type PartnerAccessRole = 'owner' | 'viewer' | 'moderator';

export type PartnerLookup = (
  userId: string,
  targetType: PartnerTargetType,
  targetId: string
) => Promise<{ role: 'owner' | 'viewer' } | null | undefined>;

export const PartnerTargetInputSchema = z.object({
  targetType: z.enum(['organiser', 'venue']),
  targetId: z.string().min(1),
});

const STAFF_ROLES = new Set(['moderator', 'admin']);

export function partnerForbidden(message: string): TRPCError {
  return new TRPCError({
    code: 'FORBIDDEN',
    message,
    cause: new ApplicationError(ErrorCode.PARTNER_FORBIDDEN, message),
  });
}

export async function checkPartnerAccess(
  args: {
    user: { id: string; role?: string | null };
    targetType: PartnerTargetType;
    targetId: string;
    needs?: PartnerNeeds;
    allowModerator?: boolean;
  },
  lookup: PartnerLookup
): Promise<PartnerAccessRole> {
  const { user, targetType, targetId } = args;
  const needs = args.needs ?? 'viewer';
  if ((args.allowModerator ?? true) && user.role && STAFF_ROLES.has(user.role)) {
    return 'moderator';
  }
  const member = await lookup(user.id, targetType, targetId);
  if (!member || (needs === 'owner' && member.role !== 'owner')) {
    throw partnerForbidden(`No ${needs} access to ${targetType} ${targetId}`);
  }
  return member.role;
}
