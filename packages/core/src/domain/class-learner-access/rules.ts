import type { AccessRelation, RevokeRefusal } from './schema';

/**
 * Who may take away whose access. Pure, so the UI can grey out the button using the same rule
 * the write path enforces, and browser-safe for the same reason.
 */

export type AccessRow = {
  userId: string;
  relation: AccessRelation;
};

export type RevokeCheck = { allowed: true } | { allowed: false; refusal: RevokeRefusal };

export function checkRevokeLearnerAccess(input: {
  rows: AccessRow[];
  targetUserId: string;
  actorUserId: string;
  actorIsTeacher: boolean;
  isMinor: boolean;
}): RevokeCheck {
  const { rows, targetUserId, actorUserId, actorIsTeacher, isMinor } = input;

  const target = rows.find(row => row.userId === targetUserId);
  if (!target) {
    return { allowed: false, refusal: 'notFound' };
  }

  // A learner nobody can see is a learner whose session notes are gone and whose balance
  // nobody can question. The guru can still delete the learner outright; they cannot orphan it.
  if (rows.length <= 1) {
    return { allowed: false, refusal: 'lastAccess' };
  }

  /**
   * The asymmetry that matters. Without it a fifteen year old removes the parent who is paying
   * for the classes, and the guru ends up refereeing a family argument through a support
   * request. A guardian may remove a `self` row; a `self` row may not remove a guardian.
   *
   * A teacher is exempt — they are the one who cleans up after a wrong email address.
   */
  if (!actorIsTeacher && target.relation === 'guardian') {
    const actor = rows.find(row => row.userId === actorUserId);
    if (actor?.relation === 'self') {
      return { allowed: false, refusal: 'selfCannotRemoveGuardian' };
    }
  }

  if (isMinor && target.relation === 'guardian') {
    const remainingGuardians = rows.filter(
      row => row.relation === 'guardian' && row.userId !== targetUserId
    ).length;
    if (remainingGuardians === 0) {
      return { allowed: false, refusal: 'lastGuardianOfMinor' };
    }
  }

  return { allowed: true };
}
