import { listEventsByVenue } from '../event';
import { resolveFollowTarget } from '../follow/target';
import { getSpace } from '../venue-space';
import { getQr, recordScan } from './index';
import { classifyScanEvents, outcomeFor, scanQueryRange, upcomingQueryFrom } from './resolve';
import type { ScanEvent, ScanOutcome } from './resolve';

/** The part of an event the scan page needs. Nothing else leaves the server. */
export type ScanEventView = Pick<
  ScanEvent,
  | 'id'
  | 'title'
  | 'startDateTime'
  | 'endDateTime'
  | 'timezone'
  | 'spaceName'
  | 'organiserId'
  | 'organiserName'
  | 'venueName'
  | 'artForm'
  | 'artists'
  | 'posterUrl'
  | 'entryType'
>;

export type ScanOutcomeView =
  | { state: 'live'; event: ScanEventView }
  | { state: 'picker'; events: ScanEventView[] }
  | { state: 'later'; events: ScanEventView[] }
  | {
      state: 'venue';
      upcoming: ScanEventView[];
      organisers: Array<{ id: string; name: string }>;
    };

export type ScanResolution =
  | { state: 'not-found' }
  | { state: 'unassigned'; code: string }
  | { state: 'retired'; venue: { id: string; name: string } | null }
  | {
      state: 'active';
      code: string;
      label: string | null;
      space: { id: string; name: string } | null;
      venue: { id: string; name: string };
      outcome: ScanOutcomeView;
    };

function toView(e: ScanEvent): ScanEventView {
  return {
    id: e.id,
    title: e.title,
    startDateTime: e.startDateTime,
    endDateTime: e.endDateTime ?? null,
    timezone: e.timezone ?? null,
    spaceName: e.spaceName ?? null,
    organiserId: e.organiserId ?? null,
    organiserName: e.organiserName ?? null,
    venueName: e.venueName ?? null,
    artForm: e.artForm ?? null,
    posterUrl: e.posterUrl ?? null,
    entryType: e.entryType ?? null,
    artists: (e.artists ?? []).map(a => ({
      id: a.id ?? null,
      title: a.title ?? null,
      name: a.name,
      role: a.role ?? null,
    })),
  };
}

function viewOf(outcome: ScanOutcome): ScanOutcomeView {
  switch (outcome.state) {
    case 'live':
      return { state: 'live', event: toView(outcome.event) };
    case 'picker':
    case 'later':
      return { state: outcome.state, events: outcome.events.map(toView) };
    case 'venue':
      return {
        state: 'venue',
        upcoming: outcome.upcoming.map(toView),
        organisers: outcome.organisers,
      };
  }
}

/** Events at a venue for the scan: the padded day range, then everything from yesterday on. */
async function loadVenueEvents(venueId: string, now: Date): Promise<ScanEvent[]> {
  const range = scanQueryRange(now);
  const [around, ahead] = await Promise.all([
    listEventsByVenue(venueId, { limit: 100, range }),
    listEventsByVenue(venueId, { limit: 60, from: upcomingQueryFrom(now) }),
  ]);
  const byId = new Map<string, ScanEvent>();
  for (const e of [...around.items, ...ahead.items]) byId.set(e.id, e as ScanEvent);
  return [...byId.values()];
}

/**
 * Resolves a scanned code to a page state (Spec, "Scan resolution").
 *
 * The scan is counted for every code that exists, retired ones included (decisions.md 2). It
 * starts first and runs beside the other reads, and it is awaited at the end with errors
 * swallowed: a Lambda can freeze once the response is sent, so a truly detached promise may
 * never finish. It costs no extra time, and a failed count never fails a scan.
 */
export async function resolveScan(
  code: string,
  now: Date = new Date(),
  options: { count?: boolean } = {}
): Promise<ScanResolution> {
  const qr = await getQr(code);
  if (!qr) return { state: 'not-found' };

  // `count: false` is a plain read (the add-a-concert and done pages): no scan is recorded.
  const counted =
    options.count === false
      ? Promise.resolve()
      : recordScan(code, now).catch(error => {
          console.error('Failed to record scan:', error);
        });

  try {
    if (qr.status === 'unassigned') return { state: 'unassigned', code };

    // A merged venue is followed to its canonical record.
    const venue = qr.venueId ? await resolveFollowTarget('venue', qr.venueId) : null;
    if (qr.status === 'retired') {
      return { state: 'retired', venue: venue ? { id: venue.id, name: venue.name } : null };
    }
    if (!venue) return { state: 'retired', venue: null };

    const [space, events] = await Promise.all([
      qr.spaceId ? getSpace(venue.id, qr.spaceId) : Promise.resolve(null),
      loadVenueEvents(venue.id, now),
    ]);
    const outcome = outcomeFor(classifyScanEvents(events, { now, spaceId: qr.spaceId }));
    return {
      state: 'active',
      code,
      label: qr.label ?? null,
      space: space ? { id: space.spaceId, name: space.name } : null,
      venue: { id: venue.id, name: venue.name },
      outcome: viewOf(outcome),
    };
  } finally {
    await counted;
  }
}
