import { ApplicationError, ErrorCode } from '../../constants';
import { isConditionalFailure } from '../class-enrollment/outcome';
import { OrganiserEntity } from '../organiser/entity';
import { addPartnerMember } from '../partner-member';
import type { PartnerMember } from '../partner-member';
import type { PartnerRole, PartnerTargetType } from '../partner-member/schema';
import { PARTNER_INVITE_TTL_DAYS } from '../venue-qr/constants';
import { VenueEntity } from '../venue/entity';
import { PartnerInviteEntity } from './entity';
import type { PartnerInvite } from './entity';

export type { PartnerInvite } from './entity';
export { PARTNER_INVITE_TTL_DAYS } from '../venue-qr/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isInviteExpired(invite: Pick<PartnerInvite, 'expiresAt'>, now: Date): boolean {
  return new Date(invite.expiresAt).getTime() <= now.getTime();
}

const MAX_MERGE_HOPS = 5;

/**
 * The live target for an id. A merged record points at its canonical (`mergedIntoId`); the
 * invite may predate the merge, so it is followed (bounded) and the canonical is returned.
 */
async function readTarget(
  targetType: PartnerTargetType,
  targetId: string
): Promise<{ id: string; name: string; verifiedAt?: string } | null> {
  let id = targetId;
  for (let hop = 0; hop <= MAX_MERGE_HOPS; hop++) {
    const result =
      targetType === 'organiser'
        ? await OrganiserEntity.get({ id }).go()
        : await VenueEntity.get({ id }).go();
    const row = result.data as {
      id: string;
      name: string;
      verifiedAt?: string;
      deletedAt?: string;
      mergedIntoId?: string;
    } | null;
    if (!row) return null;
    if (row.mergedIntoId && row.mergedIntoId !== id) {
      id = row.mergedIntoId;
      continue;
    }
    return row.deletedAt ? null : row;
  }
  return null;
}

/**
 * Creates or renews an invite. A second invite for the same email and target overwrites the
 * first (`put`, rule 8): expiry restarts and an earlier acceptance is cleared.
 */
export async function createPartnerInvite(
  input: {
    targetType: PartnerTargetType;
    targetId: string;
    email: string;
    role: PartnerRole;
    invitedBy: string;
  },
  now: Date = new Date()
): Promise<PartnerInvite> {
  const target = await readTarget(input.targetType, input.targetId);
  if (!target) {
    throw new ApplicationError(
      input.targetType === 'venue' ? ErrorCode.VENUE_NOT_FOUND : ErrorCode.ORGANISER_NOT_FOUND,
      `${input.targetType} ${input.targetId} not found`
    );
  }
  const result = await PartnerInviteEntity.put({
    email: normalizeInviteEmail(input.email),
    targetType: input.targetType,
    targetId: input.targetId,
    role: input.role,
    invitedBy: input.invitedBy,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PARTNER_INVITE_TTL_DAYS * DAY_MS).toISOString(),
  }).go();
  return result.data as PartnerInvite;
}

export async function listInvitesByEmail(email: string): Promise<PartnerInvite[]> {
  const result = await PartnerInviteEntity.query
    .primary({ email: normalizeInviteEmail(email) })
    .go({ pages: 'all' });
  return (result.data as PartnerInvite[]) ?? [];
}

export async function revokePartnerInvite(
  email: string,
  targetType: PartnerTargetType,
  targetId: string
): Promise<void> {
  await PartnerInviteEntity.delete({
    email: normalizeInviteEmail(email),
    targetType,
    targetId,
  }).go();
}

/**
 * Accepts one invite for a signed-in user.
 *
 * - The signed-in email must equal the invite's: `PARTNER_INVITE_EMAIL_MISMATCH`.
 * - Past `expiresAt`: `PARTNER_INVITE_EXPIRED`.
 * - The membership is written first, then `verifiedAt` is set on the target when the role is
 *   `owner` and none is set yet, then the invite is marked accepted. Every step is safe to
 *   repeat, so a crash part-way is healed by the next sign-in.
 *
 * Only the invited target is verified (owner decision 12). `Organiser.venueId` is the usual hall,
 * often rented, so it proves no ownership of that venue.
 */
export async function acceptPartnerInvite(
  invite: PartnerInvite,
  user: { id: string; email: string },
  now: Date = new Date()
): Promise<PartnerMember> {
  if (normalizeInviteEmail(user.email) !== invite.email) {
    throw new ApplicationError(
      ErrorCode.PARTNER_INVITE_EMAIL_MISMATCH,
      'The signed-in email differs from the invited email'
    );
  }
  if (isInviteExpired(invite, now)) {
    throw new ApplicationError(ErrorCode.PARTNER_INVITE_EXPIRED, 'The invite has expired');
  }
  const target = await readTarget(invite.targetType, invite.targetId);
  if (!target) {
    throw new ApplicationError(
      invite.targetType === 'venue' ? ErrorCode.VENUE_NOT_FOUND : ErrorCode.ORGANISER_NOT_FOUND,
      `${invite.targetType} ${invite.targetId} not found`
    );
  }

  const member = await addPartnerMember({
    userId: user.id,
    targetType: invite.targetType,
    targetId: target.id,
    targetName: target.name,
    role: invite.role,
    invitedBy: invite.invitedBy,
  });

  if (invite.role === 'owner' && !target.verifiedAt) {
    try {
      const entity = invite.targetType === 'organiser' ? OrganiserEntity : VenueEntity;
      await entity
        .patch({ id: target.id })
        .set({ verifiedAt: now.toISOString() })
        .where((attr, op) => op.notExists(attr.verifiedAt))
        .go();
    } catch (error) {
      // Someone else verified it a moment ago. That is the outcome we wanted.
      if (!isConditionalFailure(error)) throw error;
    }
  }

  await PartnerInviteEntity.patch({
    email: invite.email,
    targetType: invite.targetType,
    targetId: invite.targetId,
  })
    .set({ acceptedAt: now.toISOString() })
    .go();

  return member;
}

/**
 * Called after `findOrCreateUser` on sign-in. Accepts every pending, unexpired invite for the
 * user's email. Expired ones are returned so the caller can say so; invites whose target has
 * since been deleted are skipped.
 */
export async function acceptInvitesForUser(
  user: { id: string; email: string },
  now: Date = new Date()
): Promise<{ accepted: PartnerMember[]; expired: PartnerInvite[] }> {
  const invites = await listInvitesByEmail(user.email);
  const accepted: PartnerMember[] = [];
  const expired: PartnerInvite[] = [];

  for (const invite of invites) {
    if (invite.acceptedAt) continue;
    if (isInviteExpired(invite, now)) {
      expired.push(invite);
      continue;
    }
    try {
      accepted.push(await acceptPartnerInvite(invite, user, now));
    } catch (error) {
      const gone =
        error instanceof ApplicationError &&
        (error.code === ErrorCode.VENUE_NOT_FOUND || error.code === ErrorCode.ORGANISER_NOT_FOUND);
      if (!gone) throw error;
    }
  }
  return { accepted, expired };
}
