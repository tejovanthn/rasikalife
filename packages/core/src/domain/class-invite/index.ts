import { generateId } from '../../utils';
import { ClassInviteEntity } from './entity';
import type { ClassInvite } from './entity';
import { normalizeInviteEmail } from './schema';
import type { CreateClassInviteInput } from './schema';

export async function createClassInvite(input: CreateClassInviteInput): Promise<ClassInvite> {
  const result = await ClassInviteEntity.create({
    id: generateId(),
    normalizedEmail: normalizeInviteEmail(input.email),
    rawEmail: input.email.trim(),
    institutionId: input.institutionId,
    programId: input.programId,
    learnerId: input.learnerId,
    learnerName: input.learnerName,
    relation: input.relation,
    invitedBy: input.invitedBy,
  }).go();
  return result.data as ClassInvite;
}

/** Every invite ever sent to this address, claimed or not. */
export async function listInvitesForEmail(email: string): Promise<ClassInvite[]> {
  const result = await ClassInviteEntity.query
    .primary({ normalizedEmail: normalizeInviteEmail(email) })
    .go({ pages: 'all' });
  return (result.data as ClassInvite[]) ?? [];
}

/** Every invite this institution has sent, newest last. */
export async function listInstitutionInvites(institutionId: string): Promise<ClassInvite[]> {
  if (!institutionId) {
    return [];
  }
  const result = await ClassInviteEntity.query
    .byInstitution({ institutionId })
    .go({ pages: 'all' });
  return (result.data as ClassInvite[]) ?? [];
}

/** The ones still waiting on somebody to sign in — what a guru can correct or withdraw. */
export async function listOutstandingInvites(institutionId: string): Promise<ClassInvite[]> {
  const invites = await listInstitutionInvites(institutionId);
  return invites.filter(invite => !invite.claimedAt);
}

/** What the sign-in hook acts on. */
export async function listUnclaimedInvites(email: string): Promise<ClassInvite[]> {
  const invites = await listInvitesForEmail(email);
  return invites.filter(invite => !invite.claimedAt);
}

/**
 * Marks an invite claimed, and refuses to do it twice.
 *
 * The claim runs on every sign-in, so two tabs opening at once will both find the same
 * unclaimed invite. Without the condition, both create an access row and — for a
 * `learnerName` invite — two learners with the same name, two enrollments and two balances.
 * Returns null when somebody else got there first, which the caller treats as "already done".
 */
export async function markInviteClaimed(
  normalizedEmail: string,
  id: string,
  claimedByUserId: string
): Promise<ClassInvite | null> {
  try {
    const result = await ClassInviteEntity.patch({ normalizedEmail, id })
      .set({ claimedAt: new Date().toISOString(), claimedByUserId })
      .where((attr, op) => `${op.notExists(attr.claimedAt)}`)
      .go({ response: 'all_new' });
    return (result.data as ClassInvite) ?? null;
  } catch (error) {
    const message = (error as { message?: string })?.message ?? '';
    if (message.includes('ConditionalCheckFailed') || (error as { code?: number })?.code === 4001) {
      return null;
    }
    throw error;
  }
}

export async function deleteClassInvite(normalizedEmail: string, id: string): Promise<void> {
  await ClassInviteEntity.delete({ normalizedEmail, id }).go();
}

export { claimClassInvites } from './claim';
export type { ClaimedInvite } from './claim';
export { ClassInviteEntity } from './entity';
export type { ClassInvite } from './entity';
export { CreateClassInviteSchema, normalizeInviteEmail } from './schema';
export type { CreateClassInviteInput } from './schema';
