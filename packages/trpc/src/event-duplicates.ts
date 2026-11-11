import { Event } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { TRPCError } from '@trpc/server';

/**
 * The blocking duplicate check, as the two writers use it: `submitVerified` before it writes
 * anything, and `approveEvent` before it approves. The rule is `findLikelyDuplicates` (same
 * venue, start within 30 minutes, same programme). It refuses unless the caller passed
 * `notDuplicateOf` for every match, and the acknowledgement is stored on the event so the next
 * writer does not ask again.
 */

export interface DraftToCheck {
  id: string;
  venueId?: string | null;
  startDateTime: string;
  title: string;
  artists?: Array<{ id?: string | null; name: string; role?: string | null }> | null;
  notDuplicateOf?: string[] | null;
}

export interface LikelyDuplicateHit {
  eventId: string;
  title: string;
  duplicates: Array<{ id: string; title: string; startDateTime: string; status?: string | null }>;
}

/**
 * Likely duplicates of each draft. The drafts of one batch are excluded from each other: they
 * come from one poster set and may share an evening on purpose, and the ones that are not
 * `submitted` yet cannot match anyway.
 */
export async function likelyDuplicatesOfDrafts(
  drafts: DraftToCheck[]
): Promise<LikelyDuplicateHit[]> {
  const batchIds = drafts.map(d => d.id);
  const hits = await Promise.all(
    drafts.map(async d => {
      const found = await Event.findLikelyDuplicateEvents({
        id: d.id,
        venueId: d.venueId,
        startDateTime: d.startDateTime,
        title: d.title,
        artists: d.artists,
        notDuplicateOf: d.notDuplicateOf,
        excludeIds: batchIds,
      });
      return {
        eventId: d.id,
        title: d.title,
        duplicates: found.map(f => ({
          id: f.id,
          title: f.title,
          startDateTime: f.startDateTime,
          status: f.status,
        })),
      };
    })
  );
  return hits.filter(h => h.duplicates.length > 0);
}

/** Throws CONFLICT, naming the events, when any hit is left. Nothing has been written yet. */
export function assertNoLikelyDuplicates(hits: LikelyDuplicateHit[]): void {
  if (hits.length === 0) return;
  const text = hits
    .map(
      h => `"${h.title}" looks like ${h.duplicates.map(d => `"${d.title}" (${d.id})`).join(', ')}`
    )
    .join('; ');
  const message = `Likely duplicate: ${text}. Skip it, or confirm it is a different event.`;
  throw new TRPCError({
    code: 'CONFLICT',
    message,
    cause: new ApplicationError(ErrorCode.EVENT_LIKELY_DUPLICATE, message),
  });
}
