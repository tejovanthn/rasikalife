/**
 * Dates and times for notification text, always in the event's own zone. The Lambda runs in UTC,
 * so a bare `toLocaleTimeString` would print "12:30 pm" for a 6:00 pm concert.
 *
 * Shapes come from Copy: `Sat 16 Nov`, `6:00 pm`, and ranges `16 to 29 Nov`.
 */
import { DEFAULT_TIMEZONE } from '../venue-qr/constants';

function parts(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).formatToParts(
    instant
  )) {
    out[part.type] = part.value;
  }
  return out;
}

/** `Sat 16 Nov`. */
export function formatDay(iso: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = parts(new Date(iso), timeZone || DEFAULT_TIMEZONE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** `6:00 pm`. */
export function formatTime(iso: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = parts(new Date(iso), timeZone || DEFAULT_TIMEZONE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${Number(p.hour)}:${p.minute} ${String(p.dayPeriod).toLowerCase()}`;
}

/**
 * `16 to 29 Nov`, or `28 Nov to 11 Dec` across a month. Takes two `YYYY-MM-DD` dates, which are
 * already calendar days, so no zone is involved.
 */
export function formatDateRange(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  const month = (d: Date) => parts(d, 'UTC', { month: 'short' }).month;
  const day = (d: Date) => String(d.getUTCDate());
  if (month(a) === month(b) && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${day(a)} to ${day(b)} ${month(b)}`;
  }
  return `${day(a)} ${month(a)} to ${day(b)} ${month(b)}`;
}
