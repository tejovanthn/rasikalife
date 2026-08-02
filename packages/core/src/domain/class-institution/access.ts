/**
 * The teacher half of `assertClassAccess`, kept browser-safe.
 *
 * It lives apart from `index.ts` because a route needs it and `index.ts` imports the entity,
 * which drags ElectroDB and the AWS SDK into the client bundle.
 */

/** Structural, not `EntityItem`: importing the entity is the thing this file exists to avoid. */
export type ClassInstitutionRef = {
  ownerUserId: string;
  teacherIds?: string[];
};

/**
 * A predicate over an already-loaded record rather than a lookup, because the caller has
 * almost always just read the institution to do something else with it, and an authorisation
 * check that costs a round trip gets skipped.
 */
export function isInstitutionTeacher(institution: ClassInstitutionRef, userId: string): boolean {
  if (!userId) {
    return false;
  }
  // `ownerUserId` is checked as well as the list. The list is seeded with the owner on create,
  // but a row written before that was true, or one whose list was rebuilt by a form, must not
  // be able to lock the owner out of their own institution.
  return institution.ownerUserId === userId || (institution.teacherIds ?? []).includes(userId);
}
