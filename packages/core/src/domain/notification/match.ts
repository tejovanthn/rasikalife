/**
 * The matching algorithm behind the weekly digest and the day-before reminder. Pure: no
 * database, no clock except the `now` passed in. `run.ts` loads the data and calls these.
 *
 * Both jobs do the same thing. Start from the approved events in a window, work out what each
 * event is "about" (venue, organiser, each artist), look up who follows those, and group by user.
 */
import { addDaysToDate, dateInTimeZone, todayInTimeZone } from '../../shared/timezone';
import {
  DIGEST_MAX_EVENTS,
  DIGEST_WINDOW_DAYS,
  REASON_WEIGHTS,
  REMINDER_MAX_PER_DAY,
} from '../venue-qr/constants';

export type FollowType = 'venue' | 'organiser' | 'artist';

export interface NotifyEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  venueId?: string;
  venueName?: string;
  organiserId?: string;
  organiserName?: string;
}

export interface TargetRef {
  type: FollowType;
  id: string;
  name: string;
}

export type Reason =
  | { kind: 'rsvp' }
  | { kind: 'follow'; type: FollowType; id: string; name: string };

export interface UserEntry {
  event: NotifyEvent;
  reasons: Reason[];
  score: number;
  /** The user said they are going. Reminders always send these, outside the cap. */
  rsvp: boolean;
}

export const targetKey = (t: { type: FollowType; id: string }): string => `${t.type}:${t.id}`;

const startMs = (event: NotifyEvent): number => Date.parse(event.startDateTime);

/** Venue, organiser and each billed artist, once each. A target with no id is not followable. */
export function targetsOfEvent(
  event: NotifyEvent,
  artists: Array<{ artistId: string; artistName: string }>
): TargetRef[] {
  const out: TargetRef[] = [];
  const seen = new Set<string>();
  const add = (type: FollowType, id: string | undefined, name: string | undefined) => {
    if (!id) return;
    const key = targetKey({ type, id });
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, id, name: name?.trim() || '' });
  };
  add('venue', event.venueId, event.venueName);
  add('organiser', event.organiserId, event.organiserName);
  for (const artist of artists) add('artist', artist.artistId, artist.artistName);
  return out;
}

export function scoreReasons(reasons: Reason[]): number {
  let score = 0;
  for (const reason of reasons) {
    score += reason.kind === 'rsvp' ? REASON_WEIGHTS.rsvp : REASON_WEIGHTS[reason.type];
  }
  return score;
}

/**
 * `userId -> entries`. An event reached through several follows is one entry with several
 * reasons. A user who is going and also follows keeps both reasons; the RSVP line wins in text.
 */
export function buildUserEntries(input: {
  events: NotifyEvent[];
  targetsByEvent: Map<string, TargetRef[]>;
  followersByTarget: Map<string, string[]>;
  rsvpUsersByEvent: Map<string, string[]>;
}): Map<string, UserEntry[]> {
  const byUser = new Map<string, Map<string, Reason[]>>();
  const reasonsFor = (userId: string, eventId: string): Reason[] => {
    let events = byUser.get(userId);
    if (!events) {
      events = new Map();
      byUser.set(userId, events);
    }
    let reasons = events.get(eventId);
    if (!reasons) {
      reasons = [];
      events.set(eventId, reasons);
    }
    return reasons;
  };

  for (const event of input.events) {
    for (const userId of new Set(input.rsvpUsersByEvent.get(event.id) ?? [])) {
      reasonsFor(userId, event.id).push({ kind: 'rsvp' });
    }
    for (const target of input.targetsByEvent.get(event.id) ?? []) {
      for (const userId of new Set(input.followersByTarget.get(targetKey(target)) ?? [])) {
        reasonsFor(userId, event.id).push({
          kind: 'follow',
          type: target.type,
          id: target.id,
          name: target.name,
        });
      }
    }
  }

  const eventById = new Map(input.events.map(event => [event.id, event]));
  const result = new Map<string, UserEntry[]>();
  for (const [userId, events] of byUser) {
    const entries: UserEntry[] = [];
    for (const [eventId, reasons] of events) {
      const event = eventById.get(eventId);
      if (!event) continue;
      entries.push({
        event,
        reasons,
        score: scoreReasons(reasons),
        rsvp: reasons.some(r => r.kind === 'rsvp'),
      });
    }
    result.set(userId, entries);
  }
  return result;
}

const byDate = (a: UserEntry, b: UserEntry) =>
  startMs(a.event) - startMs(b.event) || a.event.id.localeCompare(b.event.id);
const byScoreThenDate = (a: UserEntry, b: UserEntry) => b.score - a.score || byDate(a, b);

/**
 * Up to `max` events, sorted by date. When there are more, the highest scores stay (an RSVP or
 * a followed artist beats a followed venue), and `total` lets the email say "See all N".
 */
export function selectForDigest(
  entries: UserEntry[],
  max: number = DIGEST_MAX_EVENTS
): { shown: UserEntry[]; total: number } {
  const total = entries.length;
  const kept = total > max ? [...entries].sort(byScoreThenDate).slice(0, max) : entries;
  return { shown: [...kept].sort(byDate), total };
}

/**
 * RSVPed events always, outside the cap. Then at most `max` of the rest, highest score first.
 * The rest are dropped, not delayed. Result is sorted by start time.
 */
export function selectForReminder(
  entries: UserEntry[],
  max: number = REMINDER_MAX_PER_DAY
): UserEntry[] {
  const going = entries.filter(e => e.rsvp);
  const others = entries
    .filter(e => !e.rsvp)
    .sort(byScoreThenDate)
    .slice(0, max);
  return [...going, ...others].sort(byDate);
}

/** Drops events the user already has in their concert book. Keys are `userId:eventId`. */
export function withoutLogged(
  userId: string,
  entries: UserEntry[],
  logged: Set<string>
): UserEntry[] {
  return entries.filter(e => !logged.has(`${userId}:${e.event.id}`));
}

/**
 * "You said you're going", or "Because you follow A and B", or "A, B and N more". The names are
 * ordered by weight, artists first. An event followed through nothing nameable gets no line.
 */
export function reasonLine(reasons: Reason[]): string | undefined {
  if (reasons.some(r => r.kind === 'rsvp')) return "You said you're going";
  const follows = reasons
    .filter((r): r is Extract<Reason, { kind: 'follow' }> => r.kind === 'follow' && r.name !== '')
    .sort((a, b) => REASON_WEIGHTS[b.type] - REASON_WEIGHTS[a.type]);
  const [first, second] = follows;
  if (!first) return undefined;
  // TODO(copy): the one-name line is not in Copy. This is the two-name line with the second
  // name left out.
  if (!second) return `Because you follow ${first.name}`;
  if (follows.length === 2) return `Because you follow ${first.name} and ${second.name}`;
  return `Because you follow ${first.name}, ${second.name} and ${follows.length - 2} more`;
}

/** The calendar day after "today", where today is read in the given zone. */
export function tomorrowIn(timeZone: string, now: Date): string {
  return addDaysToDate(todayInTimeZone(timeZone, now), 1);
}

/** Starts tomorrow, by the clock in the event's own zone. */
export function startsTomorrow(event: NotifyEvent, now: Date): boolean {
  return dateInTimeZone(event.startDateTime, event.timezone) === tomorrowIn(event.timezone, now);
}

/** Events in the next 14 days. The cut is on instants. */
export function digestWindow(now: Date): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000) };
}

/** The window the reminder queries, wide enough to hold "tomorrow" in any zone. */
export function reminderQueryWindow(now: Date): { from: Date; to: Date } {
  const day = 24 * 60 * 60 * 1000;
  return { from: new Date(now.getTime() - day), to: new Date(now.getTime() + 3 * day) };
}

export function inWindow(event: NotifyEvent, window: { from: Date; to: Date }): boolean {
  const at = startMs(event);
  return at >= window.from.getTime() && at < window.to.getTime();
}

/** A digest run that was retried must not mail the same person twice in a week. */
export function digestRecentlySent(lastSentAt: string | undefined, now: Date): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - Date.parse(lastSentAt) < 5 * 24 * 60 * 60 * 1000;
}
