import {
  ClassEnrollment,
  ClassInstitution,
  ClassLearner,
  ClassLearnerAccess,
  ClassProgram,
} from '@rasika/core';
import { TRPCError } from '@trpc/server';

/**
 * The one authorisation helper every class procedure goes through.
 *
 * Two ways in and no third. A **teacher** is on the institution's `teacherIds` and may read and
 * write everything under it. A **learner viewer** holds a `classLearnerAccess` row for the
 * target learner and may read that learner's own rows, mark a class attended, and write notes on
 * it. Anything else is `FORBIDDEN`.
 *
 * Note what is *not* here: a role check. Students sign in with Google and stay `editor`, the
 * ordinary default, and access is decided entirely by membership. Adding a `student` role would
 * leak into the wiki permission model, where `editor` already means something.
 *
 * A learner viewer is never granted access by `programId` alone. A program is a roster, and
 * "this user can see some learner on this program" would let one family read another's session
 * notes — so a learner-scoped call has to name the learner, and the check is against that row.
 */

export type ClassActor =
  | { kind: 'teacher'; userId: string; institutionId: string }
  | { kind: 'learner'; userId: string; institutionId: string; learnerId: string };

export type ClassAccessTarget = {
  institutionId?: string;
  programId?: string;
  learnerId?: string;
};

function forbidden(): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have access to this class',
  });
}

function notFound(what: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: `${what} not found` });
}

/**
 * Which institution the target belongs to.
 *
 * Resolved from whichever handle the caller had, because a client cannot be trusted to send a
 * matching `institutionId` alongside a `programId` — the pair is exactly what an attacker would
 * mismatch to have the teacher check run against an institution they own while the write lands
 * somewhere else.
 */
async function resolveInstitutionId(target: ClassAccessTarget): Promise<string> {
  if (target.programId) {
    const program = await ClassProgram.getClassProgram(target.programId);
    if (!program) {
      notFound('Program');
    }
    if (target.institutionId && target.institutionId !== program.institutionId) {
      forbidden();
    }
    return program.institutionId;
  }

  if (target.learnerId) {
    const learner = await ClassLearner.getClassLearner(target.learnerId);
    if (!learner) {
      notFound('Learner');
    }
    if (target.institutionId && target.institutionId !== learner.institutionId) {
      forbidden();
    }
    return learner.institutionId;
  }

  if (target.institutionId) {
    return target.institutionId;
  }

  forbidden();
}

export async function assertClassAccess(
  ctx: { user: { id: string } },
  target: ClassAccessTarget
): Promise<ClassActor> {
  const userId = ctx.user.id;
  const institutionId = await resolveInstitutionId(target);

  const institution = await ClassInstitution.getClassInstitution(institutionId);
  if (!institution) {
    notFound('Institution');
  }

  if (ClassInstitution.isInstitutionTeacher(institution, userId)) {
    return { kind: 'teacher', userId, institutionId };
  }

  if (target.learnerId && (await ClassLearnerAccess.hasLearnerAccess(target.learnerId, userId))) {
    return { kind: 'learner', userId, institutionId, learnerId: target.learnerId };
  }

  forbidden();
}

/** Narrows to a teacher, for the writes only a teacher may make. */
export async function assertTeacher(
  ctx: { user: { id: string } },
  target: ClassAccessTarget
): Promise<Extract<ClassActor, { kind: 'teacher' }>> {
  const actor = await assertClassAccess(ctx, target);
  if (actor.kind !== 'teacher') {
    forbidden();
  }
  return actor;
}

/**
 * The enrollment a learner-scoped call is about, with the access check already done.
 *
 * Loading the enrollment here rather than in each procedure means the "is this learner actually
 * on this program" question is answered once. Without it a caller could pair a learner they can
 * see with a program they cannot, and read a balance across the boundary.
 */
export async function assertEnrollmentAccess(
  ctx: { user: { id: string } },
  input: { programId: string; learnerId: string }
): Promise<{ actor: ClassActor; enrollment: ClassEnrollment.ClassEnrollment }> {
  const actor = await assertClassAccess(ctx, {
    programId: input.programId,
    learnerId: input.learnerId,
  });

  const enrollment = await ClassEnrollment.getEnrollment(input.programId, input.learnerId);
  if (!enrollment) {
    notFound('Enrollment');
  }

  // A teacher's access was resolved from the program; a learner viewer's from the learner. Both
  // still have to agree that this enrollment is inside the institution they were cleared for.
  if (enrollment.institutionId !== actor.institutionId) {
    forbidden();
  }

  return { actor, enrollment };
}

/** The zone every `sessionDate` is computed in. */
export async function institutionTimezone(institutionId: string): Promise<string> {
  const institution = await ClassInstitution.getClassInstitution(institutionId);
  return institution?.timezone ?? 'Asia/Kolkata';
}
