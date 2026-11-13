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
 *   repeat, so a crash part-way is healed by tapping Accept again.
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

export type PendingInvite = {
  targetType: PartnerTargetType;
  targetId: string;
  targetName: string;
  role: PartnerRole;
  invitedBy: string;
  expiresAt: string;
};

/**
 * The invites waiting for a signed-in user, found by their email. Nothing is accepted here:
 * acceptance is an explicit tap (`acceptInviteForUser`), never a side effect of signing in
 * (owner decision 20). `pending` are unexpired and not yet accepted; `expired` are past
 * `expiresAt`, returned so the page can say so. An invite whose target has been deleted is
 * left out of both.
 */
export async function listInvitesForUser(
  user: { email: string },
  now: Date = new Date()
): Promise<{ pending: PendingInvite[]; expired: PendingInvite[] }> {
  const invites = await listInvitesByEmail(user.email);
  const pending: PendingInvite[] = [];
  const expired: PendingInvite[] = [];
  for (const invite of invites) {
    if (invite.acceptedAt) continue;
    const target = await readTarget(invite.targetType, invite.targetId);
    if (!target) continue;
    const row: PendingInvite = {
      targetType: invite.targetType,
      targetId: invite.targetId,
      targetName: target.name,
      role: invite.role,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
    };
    (isInviteExpired(invite, now) ? expired : pending).push(row);
  }
  return { pending, expired };
}

/**
 * Accepts one invite, named by target, for a signed-in user. The invite is looked up by the
 * user's own email, so another address's invite is never found (`PARTNER_INVITE_NOT_FOUND`);
 * `acceptPartnerInvite` still checks the email and expiry. An invite already accepted is not
 * found either, so a revoked member cannot rejoin by replaying an old tap.
 */
export async function acceptInviteForUser(
  user: { id: string; email: string },
  target: { targetType: PartnerTargetType; targetId: string },
  now: Date = new Date()
): Promise<{ member: PartnerMember; verified: boolean }> {
  const invites = await listInvitesByEmail(user.email);
  const invite = invites.find(
    row =>
      row.targetType === target.targetType && row.targetId === target.targetId && !row.acceptedAt
  );
  if (!invite) {
    throw new ApplicationError(ErrorCode.PARTNER_INVITE_NOT_FOUND, 'No invite is waiting');
  }
  const before = await readTarget(invite.targetType, invite.targetId);
  const member = await acceptPartnerInvite(invite, user, now);
  const verified = invite.role === 'owner' && before !== null && !before.verifiedAt;
  return { member, verified };
}

/** The unaccepted, unexpired invites of one target, soonest to expire first. */
export async function listPendingInvitesForTarget(
  targetType: PartnerTargetType,
  targetId: string,
  now: Date = new Date()
): Promise<PartnerInvite[]> {
  const result = await PartnerInviteEntity.query
    .byTarget({ targetType, targetId })
    .go({ pages: 'all' });
  return ((result.data as PartnerInvite[]) ?? [])
    .filter(invite => !invite.acceptedAt && !isInviteExpired(invite, now))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/**
 * An owner's invite. Always a viewer: owners are made by moderators, since the first owner sets
 * the public Verified badge. A pending owner invite for the same email is never overwritten by
 * a viewer one (a `put` would downgrade it). Sending again renews the 14 days, as for a
 * moderator.
 */
export async function inviteViewer(
  input: { targetType: PartnerTargetType; targetId: string; email: string; invitedBy: string },
  now: Date = new Date()
): Promise<PartnerInvite> {
  const pending = await listPendingInvitesForTarget(input.targetType, input.targetId, now);
  const email = normalizeInviteEmail(input.email);
  if (pending.some(invite => invite.email === email && invite.role === 'owner')) {
    throw new ApplicationError(
      ErrorCode.PARTNER_FORBIDDEN,
      'An owner invite is already waiting for this email'
    );
  }
  return createPartnerInvite(
    {
      targetType: input.targetType,
      targetId: input.targetId,
      email: input.email,
      invitedBy: input.invitedBy,
      role: 'viewer',
    },
    now
  );
}

/**
 * Withdraws an invite that has not been accepted. An accepted one is a membership now (revoke
 * that instead), and an owner invite is a moderator's to withdraw. Another target's invite is
 * never found, since the lookup names this target.
 */
export async function withdrawPartnerInvite(
  email: string,
  targetType: PartnerTargetType,
  targetId: string
): Promise<void> {
  const result = await PartnerInviteEntity.get({
    email: normalizeInviteEmail(email),
    targetType,
    targetId,
  }).go();
  const invite = result.data as PartnerInvite | null;
  if (!invite || invite.acceptedAt) {
    throw new ApplicationError(ErrorCode.PARTNER_INVITE_NOT_FOUND, 'No invite is waiting');
  }
  if (invite.role === 'owner') {
    throw new ApplicationError(
      ErrorCode.PARTNER_FORBIDDEN,
      'Only a moderator can withdraw an owner invite'
    );
  }
  await revokePartnerInvite(invite.email, targetType, targetId);
}
