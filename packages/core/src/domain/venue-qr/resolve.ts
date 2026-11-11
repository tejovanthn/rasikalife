import { addDaysToDate, dateInTimeZone } from '../../shared/timezone';
import {
  DEFAULT_EVENT_DURATION_MIN,
  DEFAULT_TIMEZONE,
  LIVE_WINDOW_AFTER_MIN,
  LIVE_WINDOW_BEFORE_MIN,
  VENUE_MODE_UPCOMING_LIMIT,
} from './constants';

/**
 * Scan resolution, as pure functions. Browser-safe: no table, no clock but the `now` passed in.
 *
 * An event is read in its own `timezone`: "today" is the day in that zone, never the Lambda's.
 * Live is decided on instants (start minus 90 minutes to end plus 30), so a concert that crosses
 * midnight still resolves after midnight, and yesterday's late concert is a candidate.
 */

export interface ScanEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string | null;
  timezone?: string | null;
  status?: string | null;
  deletedAt?: string | null;
  mergedIntoId?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  organiserId?: string | null;
  organiserName?: string | null;
  venueName?: string | null;
  artForm?: string | null;
  artists?: Array<{
    id?: string | null;
    title?: string | null;
    name: string;
    role?: string | null;
  }> | null;
}

export interface ScanWindowConfig {
  beforeMin: number;
  afterMin: number;
  defaultDurationMin: number;
  upcomingLimit: number;
}

export const DEFAULT_SCAN_WINDOW: ScanWindowConfig = {
  beforeMin: LIVE_WINDOW_BEFORE_MIN,
  afterMin: LIVE_WINDOW_AFTER_MIN,
  defaultDurationMin: DEFAULT_EVENT_DURATION_MIN,
  upcomingLimit: VENUE_MODE_UPCOMING_LIMIT,
};

const MIN = 60_000;

/** Approved, not deleted, not merged away, with a readable start. */
export function isScanCandidate(event: ScanEvent): boolean {
  return (
    event.status === 'approved' &&
    !event.deletedAt &&
    !event.mergedIntoId &&
    !Number.isNaN(Date.parse(event.startDateTime))
  );
}

/** With a code `spaceId`: events in that space plus events with no space. Otherwise all. */
export function matchesSpace(event: ScanEvent, spaceId?: string | null): boolean {
  if (!spaceId) return true;
  return !event.spaceId || event.spaceId === spaceId;
}

/** End instant (ms). A missing or unreadable end is start plus the default duration. */
export function eventEndMs(event: ScanEvent, config = DEFAULT_SCAN_WINDOW): number {
  const start = Date.parse(event.startDateTime);
  const end = event.endDateTime ? Date.parse(event.endDateTime) : Number.NaN;
  return Number.isNaN(end) || end <= start ? start + config.defaultDurationMin * MIN : end;
}

export function isLive(event: ScanEvent, now: Date, config = DEFAULT_SCAN_WINDOW): boolean {
  const start = Date.parse(event.startDateTime);
  const t = now.getTime();
  return (
    t >= start - config.beforeMin * MIN && t <= eventEndMs(event, config) + config.afterMin * MIN
  );
}

/** Starts after now and on today's date in the event's own zone. */
export function isLaterToday(event: ScanEvent, now: Date): boolean {
  const start = Date.parse(event.startDateTime);
  if (start <= now.getTime()) return false;
  const zone = event.timezone || DEFAULT_TIMEZONE;
  return dateInTimeZone(start, zone) === dateInTimeZone(now, zone);
}

export interface ScanClassification {
  live: ScanEvent[];
  laterToday: ScanEvent[];
  /** Future events not live, soonest first, capped at the venue-mode limit. */
  upcoming: ScanEvent[];
}

const byStart = (a: ScanEvent, b: ScanEvent) =>
  Date.parse(a.startDateTime) - Date.parse(b.startDateTime) || a.id.localeCompare(b.id);

export function classifyScanEvents(
  events: ScanEvent[],
  opts: { now: Date; spaceId?: string | null; config?: ScanWindowConfig }
): ScanClassification {
  const config = opts.config ?? DEFAULT_SCAN_WINDOW;
  const candidates = events
    .filter(isScanCandidate)
    .filter(e => matchesSpace(e, opts.spaceId))
    .sort(byStart);
  const live = candidates.filter(e => isLive(e, opts.now, config));
  const liveIds = new Set(live.map(e => e.id));
  const rest = candidates.filter(
    e => !liveIds.has(e.id) && Date.parse(e.startDateTime) > opts.now.getTime()
  );
  return {
    live,
    laterToday: rest.filter(e => isLaterToday(e, opts.now)),
    upcoming: rest.slice(0, config.upcomingLimit),
  };
}

/** Distinct organisers of these events, in order of first appearance. */
export function organisersOf(events: ScanEvent[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const e of events) {
    if (e.organiserId && !seen.has(e.organiserId)) {
      seen.set(e.organiserId, e.organiserName ?? '');
    }
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

/**
 * The `byVenue` sort-key range that holds every possible live or later-today event. Stored
 * times carry their own offsets, so the range is padded by whole days and instants decide.
 */
export function scanQueryRange(now: Date): { from: string; to: string } {
  const day = now.toISOString().slice(0, 10);
  return { from: addDaysToDate(day, -2), to: addDaysToDate(day, 3) };
}

/** Where the upcoming read starts (yesterday, so a live concert from last night is included). */
export function upcomingQueryFrom(now: Date): string {
  return addDaysToDate(now.toISOString().slice(0, 10), -1);
}

export type ScanOutcome =
  | { state: 'live'; event: ScanEvent }
  | { state: 'picker'; events: ScanEvent[] }
  | { state: 'later'; events: ScanEvent[] }
  | { state: 'venue'; upcoming: ScanEvent[]; organisers: Array<{ id: string; name: string }> };

/** The page state for an active code, from the classification. */
export function outcomeFor(c: ScanClassification): ScanOutcome {
  if (c.live.length === 1) return { state: 'live', event: c.live[0] };
  if (c.live.length > 1) return { state: 'picker', events: c.live };
  if (c.laterToday.length > 0) return { state: 'later', events: c.laterToday };
  return { state: 'venue', upcoming: c.upcoming, organisers: organisersOf(c.upcoming) };
}
