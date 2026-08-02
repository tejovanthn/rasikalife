import { z } from 'zod';
import { CLASS_MODES, PROGRAM_TYPES } from '../class-program/schema';

/**
 * ```
 *                   guru confirms (notes required)
 *                   or cron after autoConfirmAt
 *   pending ──────────────────────────────────────> confirmed  [terminal]
 *      │
 *      ├── guru marks absent ───────────────────────> absent    [terminal]
 *      │
 *      └── guru disputes ───────────────────────────> disputed  [resolved by hand]
 * ```
 *
 * The student marks a class attended, which creates a `pending` row; the guru confirms. That
 * is the answer to "who is the source of truth": the student initiates, the guru has final
 * say, and neither is blocked waiting on the other.
 */
export const SESSION_STATUSES = ['pending', 'confirmed', 'disputed', 'absent'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** How long the guru has to object before the ledger moves without her. */
export const AUTO_CONFIRM_DAYS = 7;

/** Bulk confirm is a loop of transactions, so the cap is a real one and not a UI nicety. */
export const BULK_CONFIRM_LIMIT = 50;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const MarkClassSessionSchema = z.object({
  programId: z.string().min(1),
  learnerId: z.string().min(1),
  institutionId: z.string().min(1),
  // Not `z.string().date()`: the value must be the teacher's local date, computed by
  // `todayInTimeZone`, and a loose parse would let a caller's own midnight through.
  sessionDate: z.string().regex(DATE_ONLY, 'Session date must be YYYY-MM-DD'),
  startsAt: z.string().datetime().optional(),
  timezone: z.string().min(1).max(64).default('Asia/Kolkata'),
  mode: z.enum(CLASS_MODES),
  teacherId: z.string().min(1).optional(),
  groupSessionId: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
  programTitle: z.string().min(1).max(200).optional(),
  programType: z.enum(PROGRAM_TYPES),
  markedBy: z.string().min(1).optional(),
});

export type MarkClassSessionInput = z.infer<typeof MarkClassSessionSchema>;

/**
 * Confirming requires notes from a person and does not from the cron.
 *
 * The note is the durable value of the whole product — it is what a learner still reads two
 * years later, and what survives a program being archived. Requiring it of the guru is the
 * only moment in the flow where the tool asks for something in exchange for moving money's
 * worth of credit. The cron has nothing to say and must not be made to invent something.
 */
export const ConfirmClassSessionSchema = z
  .object({
    confirmedBy: z.string().min(1),
    notes: z.string().max(2000).optional(),
  })
  .refine(input => input.confirmedBy === 'system' || Boolean(input.notes?.trim()), {
    message: 'Add a note about what you covered',
    path: ['notes'],
  });

export type ConfirmClassSessionInput = z.infer<typeof ConfirmClassSessionSchema>;

/** Which statuses have taken a credit. The other half of the balance invariant. */
export function consumesCredit(
  session: { status: SessionStatus },
  skipPolicy: 'burn' | 'no-burn'
): boolean {
  if (session.status === 'confirmed') {
    return true;
  }
  // A missed class burns a credit under the default policy, which is the prevailing
  // assumption among gurus and the option that does not start an argument about money later.
  // `disputed` takes nothing until somebody resolves it.
  return session.status === 'absent' && skipPolicy === 'burn';
}

/**
 * The balance a learner's rows say they should have.
 *
 * `creditsRemaining` is a cache of exactly this. Keeping it computable is the point of making
 * both row types immutable in effect, and it is what a repair would rebuild from.
 */
export function expectedCredits(input: {
  packs: Array<{ delta: number }>;
  sessions: Array<{ status: SessionStatus }>;
  skipPolicy: 'burn' | 'no-burn';
}): number {
  const granted = input.packs.reduce((total, pack) => total + pack.delta, 0);
  const consumed = input.sessions.filter(session =>
    consumesCredit(session, input.skipPolicy)
  ).length;
  return granted - consumed;
}

/**
 * Collapses a fan-out into one queue row.
 *
 * A twelve-person workshop otherwise floods the review queue with twelve identical rows and
 * the guru stops opening it. Solo classes are groups of one, so they fall out of this with no
 * special case.
 */
export function groupSessions<T extends { groupSessionId: string }>(
  sessions: T[]
): Array<{ groupSessionId: string; sessions: T[] }> {
  const groups = new Map<string, T[]>();
  for (const session of sessions) {
    const existing = groups.get(session.groupSessionId);
    if (existing) {
      existing.push(session);
    } else {
      groups.set(session.groupSessionId, [session]);
    }
  }
  return [...groups.entries()].map(([groupSessionId, rows]) => ({
    groupSessionId,
    sessions: rows,
  }));
}
