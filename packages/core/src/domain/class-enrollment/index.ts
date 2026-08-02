import { ClassEnrollmentEntity } from './entity';
import type { ClassEnrollment } from './entity';
import type { EnrollLearnerInput } from './schema';

/**
 * `put`, not `upsert`. Re-enrolling a learner who was removed should restore a clean row, and
 * `upsert` would hit CLAUDE.md rule 8 — a cleared `programTitle` falls out of the
 * UpdateExpression and the old title survives.
 *
 * The one thing a re-enroll must not silently reset is the balance, which is why
 * `creditsRemaining` is left to its default here and moved only through the ledger. A caller
 * wanting to re-enroll someone with credits intact should end and reactivate the enrollment
 * rather than write it again.
 */
export async function enrollLearner(input: EnrollLearnerInput): Promise<ClassEnrollment> {
  const result = await ClassEnrollmentEntity.put(input).go();
  return result.data as ClassEnrollment;
}

export async function getEnrollment(
  programId: string,
  learnerId: string
): Promise<ClassEnrollment | null> {
  const result = await ClassEnrollmentEntity.get({ programId, learnerId }).go();
  return (result.data as ClassEnrollment) ?? null;
}

/** The guru's roster for one program. */
export async function listProgramEnrollments(
  programId: string,
  options?: { activeOnly?: boolean }
): Promise<ClassEnrollment[]> {
  const result = await ClassEnrollmentEntity.query.primary({ programId }).go({ pages: 'all' });
  const items = (result.data as ClassEnrollment[]) ?? [];
  const visible = options?.activeOnly ? items.filter(e => e.status === 'active') : items;
  return [...visible].sort((a, b) => a.learnerName.localeCompare(b.learnerName));
}

/**
 * Every program a learner is on, archived ones included.
 *
 * No `activeOnly` filter and no archive filter, because this feeds the student's own history.
 * A program the guru archived still holds that learner's session notes, and hiding it would
 * delete the record from the only person it belongs to.
 */
export async function listLearnerEnrollments(learnerId: string): Promise<ClassEnrollment[]> {
  const result = await ClassEnrollmentEntity.query.byLearner({ learnerId }).go({ pages: 'all' });
  return (result.data as ClassEnrollment[]) ?? [];
}

/**
 * Records when a class was last marked, for the roster table's "Last class" column.
 *
 * A separate write from the session itself rather than a transaction: this is display-only, so a
 * failure here costs a stale date on a screen and never a wrong credit. Guarded so a backdated
 * mark cannot pull the column *backwards* — a student catching up on last Tuesday should not make
 * the roster claim nothing has happened since.
 */
export async function touchLastSession(
  programId: string,
  learnerId: string,
  sessionDate: string
): Promise<void> {
  const enrollment = await getEnrollment(programId, learnerId);
  if (!enrollment || (enrollment.lastSessionDate ?? '') >= sessionDate) {
    return;
  }
  await ClassEnrollmentEntity.patch({ programId, learnerId })
    .set({ lastSessionDate: sessionDate })
    .go();
}

export async function setEnrollmentStatus(
  programId: string,
  learnerId: string,
  status: 'active' | 'ended'
): Promise<ClassEnrollment | null> {
  const result = await ClassEnrollmentEntity.patch({ programId, learnerId })
    .set({ status })
    .go({ response: 'all_new' });
  return (result.data as ClassEnrollment) ?? null;
}

/**
 * Keeps the denormalized program title on every roster row in step with the program.
 *
 * The same obligation the artist/organiser cascades carry: a denormalized name is a promise
 * that something updates it.
 */
export async function cascadeProgramTitleUpdate(
  programId: string,
  programTitle: string | undefined
): Promise<number> {
  const enrollments = await listProgramEnrollments(programId);
  await Promise.all(
    enrollments.map(enrollment => {
      const patch = ClassEnrollmentEntity.patch({ programId, learnerId: enrollment.learnerId });
      // `.remove`, not `.set({ programTitle: undefined })` — CLAUDE.md rule 8. Clearing a
      // workshop's title back to a plain weekly class has to actually clear it.
      return programTitle === undefined
        ? patch.remove(['programTitle']).go()
        : patch.set({ programTitle }).go();
    })
  );
  return enrollments.length;
}

/** Mirrors a learner rename onto every roster row that shows it. */
export async function cascadeLearnerNameUpdate(
  learnerId: string,
  learnerName: string
): Promise<number> {
  const enrollments = await listLearnerEnrollments(learnerId);
  await Promise.all(
    enrollments.map(enrollment =>
      ClassEnrollmentEntity.patch({ programId: enrollment.programId, learnerId })
        .set({ learnerName })
        .go()
    )
  );
  return enrollments.length;
}

export { ClassEnrollmentEntity } from './entity';
export type { ClassEnrollment } from './entity';
export { ClassLedgerService } from './ledger';
export { isConditionalFailure, rejectedIndices } from './outcome';
export type { LedgerOutcome, LedgerRefusal } from './outcome';
export {
  ENROLLMENT_STATUSES,
  EnrollLearnerSchema,
  creditBalanceLabel,
  isLowBalance,
} from './schema';
export type { EnrollLearnerInput, EnrollmentStatus } from './schema';
