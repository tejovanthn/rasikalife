/**
 * Reading the result of a guarded credit movement. Pure, and browser-safe.
 *
 * Kept apart from `ledger.ts`, which constructs an ElectroDB `Service`: that construction runs
 * at import time and needs real entities, so anything importing it cannot be tested against
 * mocked ones. The interpretation of a cancelled transaction has no such need.
 */

/**
 * Why a guarded credit movement did nothing.
 *
 * `applied: false` is an ordinary outcome, not an error. The auto-confirm cron and the guru's
 * thumb race for the same row every week, and the loser must be a no-op rather than a second
 * decrement or a 500.
 */
export type LedgerRefusal = 'already-settled' | 'no-enrollment' | 'unknown';

export type LedgerOutcome<T = undefined> =
  | { applied: true; result: T }
  | { applied: false; reason: LedgerRefusal };

/**
 * Which items in a cancelled transaction were the ones that failed their condition.
 *
 * DynamoDB cancels the whole transaction when any single condition fails, and ElectroDB
 * reports that as `canceled: true` rather than throwing — so the interesting question is not
 * *whether* it failed but *which* guard tripped. A session that was already confirmed and an
 * enrollment that does not exist are both `ConditionalCheckFailed`, and they need different
 * words, so the position in the item list is what tells them apart.
 */
export function rejectedIndices(data: unknown): number[] {
  const items = Array.isArray(data) ? data : [];
  return items.reduce<number[]>((indices, item, index) => {
    const entry = item as { code?: string; rejected?: boolean } | null;
    if (entry?.rejected || entry?.code === 'ConditionalCheckFailed') {
      indices.push(index);
    }
    return indices;
  }, []);
}

/** A DynamoDB conditional failure raised as an exception rather than a cancelled transaction. */
export function isConditionalFailure(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? '';
  // 4001 is ElectroDB's own code for a failed conditional write.
  return message.includes('ConditionalCheckFailed') || (error as { code?: number })?.code === 4001;
}
