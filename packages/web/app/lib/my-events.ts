/**
 * The "My events" page: everything a user has added, grouped by where it stands. Before it, a
 * submitter had no way back to a listing once the after-submit page was closed, and an upload
 * abandoned on the verify step was lost to them, though its drafts stayed in the table.
 */

export interface MyEvent {
  id: string;
  title: string;
  startDateTime: string;
  status?: string | null;
  posterUrl?: string | null;
  festivalId?: string | null;
  moderatorNote?: string | null;
}

export interface DraftBatch<T extends MyEvent> {
  /** Resumes the verify step with every draft read off the same poster. */
  href: string;
  events: T[];
}

/**
 * Drafts grouped by the poster they came from, since the verify step works on one poster's
 * drafts at once. A draft with no poster stands alone.
 */
export function draftBatches<T extends MyEvent>(drafts: T[]): DraftBatch<T>[] {
  const batches = new Map<string, T[]>();
  for (const draft of drafts) {
    const key = draft.posterUrl || `id:${draft.id}`;
    batches.set(key, [...(batches.get(key) ?? []), draft]);
  }
  return [...batches.values()].map(events => {
    const params = new URLSearchParams();
    for (const e of events) params.append('eventId', e.id);
    if (events[0].posterUrl) params.set('posterUrl', events[0].posterUrl);
    if (events[0].festivalId) params.set('festivalId', events[0].festivalId);
    return { href: `/events/new/verify?${params}`, events };
  });
}

export function groupMyEvents<T extends MyEvent>(events: T[], now: Date = new Date()) {
  const by = (status: string) => events.filter(e => e.status === status);
  const approved = by('approved');
  const isPast = (e: T) => Date.parse(e.startDateTime) < now.getTime();
  return {
    drafts: draftBatches(by('draft')),
    inReview: by('submitted'),
    upcoming: approved.filter(e => !isPast(e)),
    past: approved.filter(isPast),
    rejected: by('rejected'),
  };
}
