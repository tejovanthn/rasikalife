import { addDaysToDate, startOfDayInstant } from '../../shared/timezone';
import { generateId } from '../../utils';
import { listProgramEnrollments, touchLastSession } from '../class-enrollment';
import { ClassLedgerService } from '../class-enrollment/ledger';
import { isConditionalFailure, rejectedIndices } from '../class-enrollment/outcome';
import type { LedgerOutcome } from '../class-enrollment/outcome';
import type { SkipPolicy } from '../class-program/schema';
import { ClassSessionEntity } from './entity';
import type { ClassSession } from './entity';
import { AUTO_CONFIRM_DAYS, BULK_CONFIRM_LIMIT } from './schema';
import type { ConfirmClassSessionInput, MarkClassSessionInput, SessionStatus } from './schema';

/**
 * Everything needed to address one row **and rewrite its keys**.
 *
 * The first four address it: the sort key carries the date, so the id alone will not do.
 * `institutionId` is not part of the primary key at all — it is here because `status` is a
 * composite of `byInstitutionStatus`, so every transition has to re-format `gsi1pk`, and
 * ElectroDB cannot do that without the other half. Omitting it does not corrupt the index; it
 * throws `Incomplete composite attributes` and the write simply fails.
 *
 * It should be the session's **real** institution rather than one the caller asserts. ElectroDB
 * is not relying on trust here — it folds `#institutionId = :institutionId` into the
 * ConditionExpression, so a wrong value refuses the write instead of writing a key that points
 * at an institution the row does not belong to. What a wrong value costs is a *misleading* answer:
 * the transaction cancels with `ConditionalCheckFailed` on the session item, which this code
 * cannot tell apart from "somebody already confirmed it". So the router derives it from the
 * program instead of accepting it from the client, and the guarantee stays a guarantee rather
 * than becoming an error message.
 */
export type ClassSessionRef = {
  programId: string;
  learnerId: string;
  sessionDate: string;
  id: string;
  institutionId: string;
};

export type SessionTransition = ClassSessionRef & { status: SessionStatus };

/**
 * When the ledger moves without the guru.
 *
 * Midnight on the seventh day after the class, on her wall — not seven times twenty-four
 * hours from an instant, which would drift by an hour twice a year and land the deadline in
 * the middle of a Tuesday.
 */
export function autoConfirmDeadline(sessionDate: string, timezone: string): string {
  return startOfDayInstant(addDaysToDate(sessionDate, AUTO_CONFIRM_DAYS), timezone);
}

/**
 * One learner, one class, `pending`.
 *
 * `groupSessionId` falls back to the row's own id, which makes a solo class a group of one.
 * The index over it is not sparse — a missing composite would write `CLASS_GROUP_SESSION#` for
 * every solo session on the platform, one hot partition that a blank lookup then matches in
 * full (CLAUDE.md rule 9) — and beyond that, it means the review queue's grouping has no
 * special case to get wrong.
 */
export async function markClassSession(input: MarkClassSessionInput): Promise<ClassSession> {
  const id = generateId();
  const result = await ClassSessionEntity.create({
    id,
    programId: input.programId,
    learnerId: input.learnerId,
    institutionId: input.institutionId,
    sessionDate: input.sessionDate,
    startsAt: input.startsAt,
    timezone: input.timezone,
    status: 'pending',
    mode: input.mode,
    teacherId: input.teacherId,
    groupSessionId: input.groupSessionId ?? id,
    notes: input.notes,
    programTitle: input.programTitle,
    programType: input.programType,
    markedBy: input.markedBy,
    autoConfirmAt: autoConfirmDeadline(input.sessionDate, input.timezone),
  }).go();

  // Display-only, and deliberately not part of the create: a failure here leaves a stale column
  // on the roster and nothing else.
  await touchLastSession(input.programId, input.learnerId, input.sessionDate);

  return result.data as ClassSession;
}

/**
 * A group class, fanned out to one row per active enrollment.
 *
 * Fan-out on write rather than a shared record with an attendance list. Reads then stay in one
 * partition per learner, a student's history looks the same whatever the class was, and a
 * learner who skipped is one row marked `absent` rather than an exception nested inside
 * somebody else's record. No credit moves here — every row lands `pending`.
 *
 * Not a transaction, and deliberately: fan-out touches nothing atomic, DynamoDB caps a
 * transaction at 100 items, and a workshop can run to 200 people. A row that fails to write is
 * a class the guru marks again, which is recoverable; a workshop that cannot be marked at all
 * because it is too big is not.
 */
export async function markGroupClassSession(
  input: Omit<MarkClassSessionInput, 'learnerId' | 'groupSessionId'>
): Promise<{ groupSessionId: string; sessions: ClassSession[] }> {
  const enrollments = await listProgramEnrollments(input.programId, { activeOnly: true });
  const groupSessionId = generateId();

  const sessions = await Promise.all(
    enrollments.map(enrollment =>
      markClassSession({ ...input, learnerId: enrollment.learnerId, groupSessionId })
    )
  );

  return { groupSessionId, sessions };
}

/**
 * Moves a session out of `pending`, and moves the credit with it when it should.
 *
 * The guard is a conditional transition **from `pending`**, not a check on the button press.
 * The auto-confirm cron and the guru's thumb race for the same row every week; without the
 * condition the loser decrements a second credit, and the learner is charged twice for one
 * class with nothing in the ledger to show why.
 *
 * With a credit to move it is one two-item transaction, so the status and the balance can
 * never disagree. With no credit to move — a dispute, or a skip under `no-burn` — it is a
 * single conditional patch, because wrapping one write in a transaction buys nothing and
 * costs double the write units.
 */
async function transitionSession(
  ref: ClassSessionRef,
  update: { status: SessionStatus; confirmedBy?: string; notes?: string },
  creditDelta: number
): Promise<LedgerOutcome<SessionTransition>> {
  const applied: SessionTransition = { ...ref, status: update.status };

  // Undefined values fall out of an ElectroDB UpdateExpression entirely (CLAUDE.md rule 8).
  // Here that is what should happen — a cron confirming without notes must leave whatever the
  // student wrote standing — but it is built explicitly so nobody has to know that to read it.
  const fields: Record<string, string> = { status: update.status };
  if (update.confirmedBy) {
    fields.confirmedBy = update.confirmedBy;
  }
  if (update.notes?.trim()) {
    fields.notes = update.notes;
  }

  // `status` is a composite of `byInstitutionStatus` and `byDue`, so changing it re-formats
  // those keys — and `institutionId` is not in the primary key, so ElectroDB has no way to know
  // it. `.composite()` is how a value is supplied purely for key formatting. Without it every
  // confirm, dispute and absent fails outright. CLAUDE.md rule 7, in its other form: patching
  // through the entity recomputes the keys, but only if you give it enough to recompute them.
  const composite = { institutionId: ref.institutionId };

  if (creditDelta === 0) {
    const result = await ClassSessionEntity.patch(ref)
      .set(fields)
      .composite(composite)
      .where((attr, op) => op.eq(attr.status, 'pending'))
      .go({ response: 'all_new' })
      .catch(error => {
        if (isConditionalFailure(error)) {
          return null;
        }
        throw error;
      });
    return result
      ? { applied: true, result: applied }
      : { applied: false, reason: 'already-settled' };
  }

  const outcome = await ClassLedgerService.transaction
    .write(({ classSession, classEnrollment }) => [
      classSession
        .patch(ref)
        .set(fields)
        .composite(composite)
        .where((attr, op) => op.eq(attr.status, 'pending'))
        .commit(),
      classEnrollment
        .patch({ programId: ref.programId, learnerId: ref.learnerId })
        .add({ creditsRemaining: creditDelta })
        .commit(),
    ])
    .go();

  if (outcome.canceled) {
    // Both guards raise ConditionalCheckFailed, so which item was rejected is the only thing
    // that tells "somebody already confirmed this" apart from "there is no enrollment".
    const rejected = rejectedIndices(outcome.data);
    if (rejected.includes(0)) {
      return { applied: false, reason: 'already-settled' };
    }
    return { applied: false, reason: rejected.includes(1) ? 'no-enrollment' : 'unknown' };
  }

  return { applied: true, result: applied };
}

/** Confirming always takes exactly one credit. */
export async function confirmClassSession(
  ref: ClassSessionRef,
  input: ConfirmClassSessionInput
): Promise<LedgerOutcome<SessionTransition>> {
  return transitionSession(
    ref,
    { status: 'confirmed', confirmedBy: input.confirmedBy, notes: input.notes },
    -1
  );
}

/** A missed class takes a credit only under the program's default `burn` policy. */
export async function markClassSessionAbsent(
  ref: ClassSessionRef,
  input: { confirmedBy: string; notes?: string; skipPolicy: SkipPolicy }
): Promise<LedgerOutcome<SessionTransition>> {
  return transitionSession(
    ref,
    { status: 'absent', confirmedBy: input.confirmedBy, notes: input.notes },
    input.skipPolicy === 'burn' ? -1 : 0
  );
}

/**
 * A dispute takes nothing until somebody resolves it by hand.
 *
 * Deliberately not a state the ledger can resolve on its own: the whole point of the status is
 * that the two people disagree about whether a class happened, and no default is right.
 */
export async function disputeClassSession(
  ref: ClassSessionRef,
  input: { confirmedBy: string; notes?: string }
): Promise<LedgerOutcome<SessionTransition>> {
  return transitionSession(
    ref,
    { status: 'disputed', confirmedBy: input.confirmedBy, notes: input.notes },
    0
  );
}

/**
 * Bulk confirm, as a loop of transactions rather than one `BatchWrite`.
 *
 * `BatchWrite` cannot carry a condition, so it would confirm rows the cron had already taken
 * and decrement twice. The cap is real, and the per-row results matter: one failure in a
 * selection of fifty must not silently drop the other forty-nine, and the guru has to be told
 * which ones did not go through.
 */
export async function confirmClassSessions(
  refs: ClassSessionRef[],
  input: ConfirmClassSessionInput
): Promise<Array<{ ref: ClassSessionRef } & LedgerOutcome<SessionTransition>>> {
  const capped = refs.slice(0, BULK_CONFIRM_LIMIT);
  const results = [];
  for (const ref of capped) {
    const outcome = await confirmClassSession(ref, input);
    results.push({ ref, ...outcome });
  }
  return results;
}

/** A learner's history on one program, oldest first, matching the sort key. */
export async function listLearnerSessions(
  programId: string,
  learnerId: string
): Promise<ClassSession[]> {
  const result = await ClassSessionEntity.query
    .primary({ programId, learnerId })
    .go({ pages: 'all' });
  return (result.data as ClassSession[]) ?? [];
}

/**
 * The guru's review queue, newest first.
 *
 * Newest first because this is a *review* queue and not an approval queue — everything here
 * auto-confirms in seven days, so her default action is to do nothing and she opens it to
 * catch mistakes. The most recent class is the one she can still remember.
 */
export async function listPendingSessions(institutionId: string): Promise<ClassSession[]> {
  const result = await ClassSessionEntity.query
    .byInstitutionStatus({ institutionId, status: 'pending' })
    .go({ pages: 'all' });
  const items = (result.data as ClassSession[]) ?? [];
  return [...items].reverse();
}

export async function listSessionsByStatus(
  institutionId: string,
  status: SessionStatus
): Promise<ClassSession[]> {
  const result = await ClassSessionEntity.query
    .byInstitutionStatus({ institutionId, status })
    .go({ pages: 'all' });
  return (result.data as ClassSession[]) ?? [];
}

/** The rows of one group class, for collapsing a fan-out into a single queue row. */
export async function listGroupSessions(groupSessionId: string): Promise<ClassSession[]> {
  const result = await ClassSessionEntity.query.byGroup({ groupSessionId }).go({ pages: 'all' });
  return (result.data as ClassSession[]) ?? [];
}

/**
 * Everything the cron should confirm, across every institution.
 *
 * One partition holds the platform's unconfirmed sessions and nothing else, so this reads only
 * rows it is about to act on. The alternative — walking institutions — needs a list of them
 * that nothing else has any reason to maintain.
 */
export async function listSessionsDueForAutoConfirm(
  now: string = new Date().toISOString()
): Promise<ClassSession[]> {
  const result = await ClassSessionEntity.query
    .byDue({ status: 'pending' })
    .lte({ autoConfirmAt: now })
    .go({ pages: 'all' });
  return (result.data as ClassSession[]) ?? [];
}

export function sessionRef(session: ClassSession): ClassSessionRef {
  return {
    programId: session.programId,
    learnerId: session.learnerId,
    sessionDate: session.sessionDate,
    id: session.id,
    // Read off the row, so it is the true one by construction.
    institutionId: session.institutionId,
  };
}

export { autoConfirmDueSessions } from './auto-confirm';
export { ClassSessionEntity } from './entity';
export type { ClassSession } from './entity';
export {
  AUTO_CONFIRM_DAYS,
  BULK_CONFIRM_LIMIT,
  ConfirmClassSessionSchema,
  MarkClassSessionSchema,
  SESSION_STATUSES,
  consumesCredit,
  expectedCredits,
  groupSessions,
} from './schema';
export type { ConfirmClassSessionInput, MarkClassSessionInput, SessionStatus } from './schema';
