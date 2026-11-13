import { DEFAULT_EVENT_TIMEZONE } from '@rasika/core/domain/event/client';
import { dateInTimeZone } from '@rasika/core/shared/timezone';

/**
 * An event's time and day, always in the event's own zone.
 *
 * The SSR Lambda runs in UTC, so a bare `toLocaleTimeString` printed "12:30 pm" for a 6:00 pm
 * concert in Chennai, and the browser then re-rendered it in the reader's zone, so a reader in
 * Ohio saw the small hours. A concert happens where the hall is; that is the time to print.
 */

interface Timed {
  startDateTime: string;
  timezone?: string | null;
}

export function eventZone(event: { timezone?: string | null }): string {
  return event.timezone || DEFAULT_EVENT_TIMEZONE;
}

/** `6:00 pm` */
export function formatEventTime(iso: string, timeZone: string = DEFAULT_EVENT_TIMEZONE): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** The `YYYY-MM-DD` the event falls on, where it happens. */
export function eventDateKey(event: Timed): string {
  return dateInTimeZone(event.startDateTime, eventZone(event));
}

/** `Sat, 24 Oct` for a `YYYY-MM-DD`. Formatted at noon UTC so no zone can move the day. */
export function formatDayLabel(dateOnly: string, opts: { year?: boolean } = {}): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(opts.year ? { year: 'numeric' } : {}),
  });
}

/** Events grouped by the day they happen on, days in order, events in start order. */
export function groupByEventDate<T extends Timed>(
  events: T[]
): Array<{ date: string; events: T[] }> {
  const map = new Map<string, T[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    const bucket = map.get(key);
    if (bucket) bucket.push(event);
    else map.set(key, [event]);
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      events: [...list].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)),
    }));
}

/**
 * The short name of the zone an event happens in, at that moment: `IST`, `PDT`, `BST`, or
 * `GMT+8` where no common abbreviation exists. Each locale knows a different set of names
 * (en-IN says IST but not PDT, en-US the reverse), so the first locale with a lettered name wins.
 */
export function zoneLabel(iso: string, timeZone: string = DEFAULT_EVENT_TIMEZONE): string {
  const date = new Date(iso);
  let fallback = '';
  for (const locale of ['en-US', 'en-GB', 'en-IN']) {
    const name =
      new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short', hour: 'numeric' })
        .formatToParts(date)
        .find(part => part.type === 'timeZoneName')?.value ?? '';
    if (name && !/^(GMT|UTC)[+-]/.test(name)) return name;
    fallback ||= name;
  }
  return fallback;
}

/**
 * Whether the time needs its zone printed. On the server, only for a concert outside India:
 * the readers and Googlebot are in India, and "IST" beside every card would be noise. In the
 * browser, also whenever the reader's zone reads differently at that moment.
 */
export function needsZoneLabel(iso: string, eventZone: string, readerZone?: string): boolean {
  if (eventZone !== DEFAULT_EVENT_TIMEZONE) return true;
  return Boolean(readerZone) && zoneLabel(iso, readerZone) !== zoneLabel(iso, eventZone);
}

/** A date in the event's zone, with whatever `Intl` options the page wants. */
export function formatEventDate(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Date(iso).toLocaleDateString('en-IN', { ...options, timeZone });
}
