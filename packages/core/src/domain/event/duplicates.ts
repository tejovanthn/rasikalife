/**
 * Concerts already listed at the same venue close to the same time: the "Is this the same
 * concert?" check on the verify step. The poster-hash check catches only the same file, and a
 * second poster of one concert (a WhatsApp forward, a re-crop, the sabha's own design) is the
 * ordinary case. Catching it here is cheaper than a `mergeEvent` afterwards, which loses the
 * second submitter's edits.
 *
 * Browser-safe and pure, so the window and the status rules are tested without a table.
 */

export const DUPLICATE_WINDOW_HOURS = 3;

export interface DuplicateCandidate {
  id: string;
  startDateTime: string;
  status?: string | null;
  mergedIntoId?: string | null;
  deletedAt?: string | null;
}

/**
 * Only an approved or submitted event counts. A draft is someone's unfinished upload, which
 * may be this very poster, and a rejected one was judged not to be a listing at all.
 */
const LISTED = new Set(['approved', 'submitted']);

export function nearDuplicates<T extends DuplicateCandidate>(
  candidates: T[],
  target: { startDateTime: string; excludeIds?: string[] },
  windowHours = DUPLICATE_WINDOW_HOURS
): T[] {
  const at = Date.parse(target.startDateTime);
  if (Number.isNaN(at)) return [];
  const exclude = new Set(target.excludeIds ?? []);
  const windowMs = windowHours * 60 * 60 * 1000;
  return candidates
    .filter(c => !exclude.has(c.id) && !c.mergedIntoId && !c.deletedAt)
    .filter(c => LISTED.has(c.status ?? ''))
    .map(c => ({ c, gap: Math.abs(Date.parse(c.startDateTime) - at) }))
    .filter(({ gap }) => gap <= windowMs)
    .sort((a, b) => a.gap - b.gap)
    .map(({ c }) => c);
}

/**
 * The `byVenue` sort-key range to read. Stored times carry their own offsets (`+05:30`, `Z`),
 * so string order is not time order within a day; reading whole days either side and
 * comparing instants in `nearDuplicates` is correct whatever offset each row was stored with.
 */
export function duplicateSearchRange(startDateTime: string): { from: string; to: string } | null {
  const at = Date.parse(startDateTime);
  if (Number.isNaN(at)) return null;
  const day = 24 * 60 * 60 * 1000;
  return {
    from: new Date(at - day).toISOString().slice(0, 10),
    to: new Date(at + 2 * day).toISOString().slice(0, 10),
  };
}
