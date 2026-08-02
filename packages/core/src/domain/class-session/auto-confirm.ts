import { confirmClassSession, listSessionsDueForAutoConfirm, sessionRef } from './index';

/**
 * Confirms every pending session past its deadline, across every institution.
 *
 * This exists so the ledger never freezes when the guru forgets. It is also what makes her
 * queue a *review* queue rather than an approval queue: because nothing waits on her, her
 * default action there is to do nothing, and she opens it to catch mistakes.
 *
 * Lives in core rather than in the cron handler so the scheduled run and any manual run cannot
 * differ — the same reasoning as the artist denorm sweeps.
 *
 * Two things it deliberately does not do:
 *
 *   - **No `Promise.all`.** Each confirm is a two-item DynamoDB transaction against one
 *     enrollment row. Firing a week's worth at once puts many writers on the same partition,
 *     and the losers come back as cancelled transactions this would then have to reason about.
 *     Sequential is slower and the sweep has all day.
 *   - **No retry on a lost race.** `applied: false` here means the guru got there first, which
 *     is the system working. It is counted, not repaired.
 */
export async function autoConfirmDueSessions(options?: {
  now?: string;
  limit?: number;
}): Promise<{ due: number; confirmed: number; alreadySettled: number; failed: number }> {
  const due = await listSessionsDueForAutoConfirm(options?.now);
  const batch = options?.limit ? due.slice(0, options.limit) : due;

  let confirmed = 0;
  let alreadySettled = 0;
  let failed = 0;

  for (const session of batch) {
    const outcome = await confirmClassSession(sessionRef(session), {
      // Not a user id. A learner reading their history should be able to tell a class the guru
      // looked at from one the clock let through.
      confirmedBy: 'system',
      // No notes. The cron has nothing to say, and inventing something would put words in the
      // guru's mouth in the one field students actually read. `confirmClassSession` leaves
      // whatever the student wrote standing.
    });

    if (outcome.applied) {
      confirmed++;
    } else if (outcome.reason === 'already-settled') {
      alreadySettled++;
    } else {
      failed++;
    }
  }

  return { due: batch.length, confirmed, alreadySettled, failed };
}
