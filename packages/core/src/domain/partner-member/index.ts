import { ApplicationError, ErrorCode } from '../../constants';
import { PartnerMemberEntity } from './entity';
import type { PartnerMember } from './entity';
import type { PartnerRole, PartnerTargetType } from './schema';

export type { PartnerMember } from './entity';
export * from './schema';

export async function getPartnerMember(
  userId: string,
  targetType: PartnerTargetType,
  targetId: string
): Promise<PartnerMember | null> {
  const result = await PartnerMemberEntity.get({ targetType, targetId, userId }).go();
  return (result.data as PartnerMember | null) ?? null;
}

/**
 * Adds a grant, or re-adds one. `put` and not `upsert` (rule 8): the row is the pair's whole
 * state. An existing `owner` is never downgraded to `viewer` by a later viewer invite.
 */
export async function addPartnerMember(input: {
  userId: string;
  targetType: PartnerTargetType;
  targetId: string;
  targetName: string;
  role: PartnerRole;
  invitedBy: string;
}): Promise<PartnerMember> {
  const existing = await getPartnerMember(input.userId, input.targetType, input.targetId);
  if (existing?.role === 'owner' && input.role === 'viewer') return existing;

  const result = await PartnerMemberEntity.put({
    ...input,
    ...(existing ? { createdAt: existing.createdAt } : {}),
  }).go();
  return result.data as PartnerMember;
}

/**
 * An owner's revoke: a viewer of this target only. Never an owner (a moderator's), never the
 * caller, and never a member of another target (the lookup names this one).
 */
export async function revokeViewerMember(
  actingUserId: string,
  userId: string,
  targetType: PartnerTargetType,
  targetId: string
): Promise<boolean> {
  if (userId === actingUserId) {
    throw new ApplicationError(ErrorCode.PARTNER_FORBIDDEN, 'You cannot remove yourself');
  }
  const existing = await getPartnerMember(userId, targetType, targetId);
  if (!existing) return false;
  if (existing.role !== 'viewer') {
    throw new ApplicationError(ErrorCode.PARTNER_FORBIDDEN, 'Only a moderator can remove an owner');
  }
  await PartnerMemberEntity.delete({ targetType, targetId, userId }).go();
  return true;
}

/** Removes a grant. Returns false when there was none. */
export async function revokePartnerMember(
  userId: string,
  targetType: PartnerTargetType,
  targetId: string
): Promise<boolean> {
  const existing = await getPartnerMember(userId, targetType, targetId);
  if (!existing) return false;
  await PartnerMemberEntity.delete({ targetType, targetId, userId }).go();
  return true;
}

export async function listPartnerMembers(
  targetType: PartnerTargetType,
  targetId: string
): Promise<PartnerMember[]> {
  const result = await PartnerMemberEntity.query
    .primary({ targetType, targetId })
    .go({ pages: 'all' });
  return (result.data as PartnerMember[]) ?? [];
}

/** The dashboards a user can open. */
export async function listPartnerTargetsForUser(userId: string): Promise<PartnerMember[]> {
  const result = await PartnerMemberEntity.query.byUser({ userId }).go({ pages: 'all' });
  return (result.data as PartnerMember[]) ?? [];
}

/**
 * The membership check behind `partnerProcedure`. Returns the member's role, or throws
 * `PARTNER_FORBIDDEN` when there is no grant or a viewer asks for an owner action.
 */
export async function requirePartnerRole(
  userId: string,
  targetType: PartnerTargetType,
  targetId: string,
  needs: PartnerRole = 'viewer'
): Promise<PartnerRole> {
  const member = await getPartnerMember(userId, targetType, targetId);
  if (!member || (needs === 'owner' && member.role !== 'owner')) {
    throw new ApplicationError(
      ErrorCode.PARTNER_FORBIDDEN,
      `No ${needs} access to ${targetType} ${targetId}`
    );
  }
  return member.role;
}

/** Boolean form of `requirePartnerRole`. */
export async function hasPartnerRole(
  userId: string,
  targetType: PartnerTargetType,
  targetId: string,
  needs: PartnerRole = 'viewer'
): Promise<boolean> {
  const member = await getPartnerMember(userId, targetType, targetId);
  return Boolean(member) && (needs === 'viewer' || member?.role === 'owner');
}

/**
 * Moves every grant on `loserId` to `canonicalId`. Where a user already holds a grant on the
 * canonical, the higher role wins. Used by the organiser and venue merge cascades.
 */
export async function movePartnerMembers(
  targetType: PartnerTargetType,
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<number> {
  const members = await listPartnerMembers(targetType, loserId);
  for (const member of members) {
    await addPartnerMember({
      userId: member.userId,
      targetType,
      targetId: canonicalId,
      targetName: canonicalName,
      role: member.role,
      invitedBy: member.invitedBy,
    });
    await PartnerMemberEntity.delete({ targetType, targetId: loserId, userId: member.userId }).go();
  }
  return members.length;
}

export async function refreshPartnerTargetName(
  targetType: PartnerTargetType,
  targetId: string,
  newName: string
): Promise<void> {
  const members = await listPartnerMembers(targetType, targetId);
  await Promise.all(
    members.map(member =>
      PartnerMemberEntity.patch({ targetType, targetId, userId: member.userId })
        .set({ targetName: newName })
        .go()
    )
  );
}

/** Account deletion: removes every grant the user holds. */
export async function deleteUserPartnerMemberships(userId: string): Promise<number> {
  const grants = await listPartnerTargetsForUser(userId);
  await Promise.all(
    grants.map(grant =>
      PartnerMemberEntity.delete({
        targetType: grant.targetType,
        targetId: grant.targetId,
        userId,
      }).go()
    )
  );
  return grants.length;
}
