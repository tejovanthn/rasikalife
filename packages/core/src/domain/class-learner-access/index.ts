import { getClassLearner } from '../class-learner';
import { ClassLearnerAccessEntity } from './entity';
import type { ClassLearnerAccess } from './entity';
import { checkRevokeLearnerAccess } from './rules';
import type { RevokeCheck } from './rules';
import type { GrantLearnerAccessInput } from './schema';
import { REVOKE_REFUSALS } from './schema';

/**
 * `put`, not `upsert`. The row is the pair's complete state — a learner/user pair has exactly
 * one relation — so there is no partial merge to serve, and `upsert` would hit CLAUDE.md
 * rule 8: an undefined value falls out of the UpdateExpression entirely, so re-granting with a
 * corrected relation would leave the old one standing.
 */
export async function grantLearnerAccess(
  input: GrantLearnerAccessInput
): Promise<ClassLearnerAccess> {
  const result = await ClassLearnerAccessEntity.put(input).go();
  return result.data as ClassLearnerAccess;
}

export async function listLearnerAccess(learnerId: string): Promise<ClassLearnerAccess[]> {
  const result = await ClassLearnerAccessEntity.query.primary({ learnerId }).go({ pages: 'all' });
  return (result.data as ClassLearnerAccess[]) ?? [];
}

/** Every learner this sign-in can see. One row means no profile switcher. */
export async function listUserLearnerAccess(userId: string): Promise<ClassLearnerAccess[]> {
  const result = await ClassLearnerAccessEntity.query.byUser({ userId }).go({ pages: 'all' });
  return (result.data as ClassLearnerAccess[]) ?? [];
}

/** The learner half of `assertClassAccess`. */
export async function hasLearnerAccess(learnerId: string, userId: string): Promise<boolean> {
  if (!learnerId || !userId) {
    return false;
  }
  const result = await ClassLearnerAccessEntity.get({ learnerId, userId }).go();
  return Boolean(result.data);
}

export type RevokeResult = RevokeCheck & { message?: string };

/**
 * Reads the learner and the whole access list before deciding, rather than taking `isMinor`
 * and the actor's relation as arguments. Both are things a caller can get wrong or pass
 * stale, and getting them wrong here means either orphaning a learner or letting a teenager
 * lock a parent out.
 */
export async function revokeLearnerAccess(input: {
  learnerId: string;
  targetUserId: string;
  actorUserId: string;
  actorIsTeacher: boolean;
}): Promise<RevokeResult> {
  const [learner, rows] = await Promise.all([
    getClassLearner(input.learnerId),
    listLearnerAccess(input.learnerId),
  ]);

  const check = checkRevokeLearnerAccess({
    rows: rows.map(row => ({ userId: row.userId, relation: row.relation })),
    targetUserId: input.targetUserId,
    actorUserId: input.actorUserId,
    actorIsTeacher: input.actorIsTeacher,
    // A learner that could not be read is treated as a minor. The failure mode of guessing
    // wrong in that direction is a revoke that has to be retried; the other direction drops a
    // parent off a child's account.
    isMinor: learner?.isMinor ?? true,
  });

  if (!check.allowed) {
    return { ...check, message: REVOKE_REFUSALS[check.refusal] };
  }

  await ClassLearnerAccessEntity.delete({
    learnerId: input.learnerId,
    userId: input.targetUserId,
  }).go();

  return { allowed: true };
}

export { ClassLearnerAccessEntity } from './entity';
export type { ClassLearnerAccess } from './entity';
export { checkRevokeLearnerAccess } from './rules';
export type { AccessRow, RevokeCheck } from './rules';
export { ACCESS_RELATIONS, GrantLearnerAccessSchema, REVOKE_REFUSALS } from './schema';
export type { AccessRelation, GrantLearnerAccessInput, RevokeRefusal } from './schema';
