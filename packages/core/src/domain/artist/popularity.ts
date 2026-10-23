/**
 * How busy an artist is on the site, for the "Popular" sort on /artists. Derived from the
 * event graph and never typed: each approved event that credits them counts one, plus the
 * RSVPs and the "I was there" logs on it. Rebuilt with the search index (every 6 hours), which
 * already loads every artist and every approved event.
 *
 * One credit per event, however many roles: a vocalist who also played the tanpura did one
 * concert. Deleted events count nothing.
 */
export interface PopularityEvent {
  artists?: Array<{ id?: string | null }> | null;
  rsvpCount?: number | null;
  attendedCount?: number | null;
  deletedAt?: string | null;
}

export function artistPopularity(events: PopularityEvent[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const event of events) {
    if (event.deletedAt) continue;
    const weight = 1 + (event.rsvpCount ?? 0) + (event.attendedCount ?? 0);
    const ids = new Set(
      (event.artists ?? []).map(a => a.id).filter((id): id is string => Boolean(id))
    );
    for (const id of ids) scores.set(id, (scores.get(id) ?? 0) + weight);
  }
  return scores;
}
