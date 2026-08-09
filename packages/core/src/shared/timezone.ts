/**
 * Which day a thing happened on, when the two people involved are not in the same day.
 *
 * A class at 8am in Chennai is 22:30 the previous evening in New York. Storing only the UTC
 * instant does not settle the argument, it moves it to a third zone that is wrong for both
 * parties: 02:30Z belongs to neither person's Monday. So a session stores both — a
 * `sessionDate` in the *teacher's* zone, because the teacher is the one who decides a class
 * happened and the credit ledger sorts on it, and a `startsAt` instant that each viewer's
 * browser renders in their own zone.
 *
 * Everything here is `Intl`. No date library, and deliberately so: the whole need is
 * "what does the calendar on this teacher's wall say", which is exactly what a time zone
 * database answers and what arithmetic on a UTC timestamp cannot.
 */

/** `YYYY-MM-DD`. The shape every `sessionDate` takes. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

/**
 * How far ahead of UTC the zone is at this instant, in milliseconds.
 *
 * Read back the wall clock the zone shows for a known instant and subtract. This is the only
 * way to get an offset without shipping a copy of the tz database, and it stays correct
 * across a DST change because it asks about one specific instant rather than the zone in
 * general.
 */
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));

  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find(p => p.type === type)?.value ?? 0);

  // `hour12: false` renders midnight as hour 24 in some ICU versions, which would push the
  // reconstructed date a day forward and put the offset out by 24 hours.
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour') % 24,
    part('minute'),
    part('second')
  );

  return wallClock - instant;
}

/** The calendar date this instant falls on, in the given zone. */
export function dateInTimeZone(instant: Date | string | number, timeZone: string): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find(p => p.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Today, on the teacher's wall.
 *
 * This is what a "mark today's class" button must use. A student in California pressing it at
 * 9pm Monday is marking the teacher's Tuesday, and the ledger has to agree with the teacher.
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return dateInTimeZone(now, timeZone);
}

/**
 * `Date.parse` is not the guard it looks like: it accepts `2026-08` and quietly reads it as
 * the first of August, so a truncated date would flow through as a real one. The regex above
 * is the actual contract, so it is what both functions check.
 */
function parseDateOnly(dateOnly: string): number {
  if (!isDateOnly(dateOnly)) {
    throw new Error(`Not a YYYY-MM-DD date: ${dateOnly}`);
  }
  const at = Date.parse(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(at)) {
    throw new Error(`Not a real date: ${dateOnly}`);
  }
  return at;
}

/** Calendar arithmetic on a `YYYY-MM-DD`, with no zone and therefore no DST to get wrong. */
export function addDaysToDate(dateOnly: string, days: number): string {
  return new Date(parseDateOnly(dateOnly) + days * 86_400_000).toISOString().slice(0, 10);
}

/** `YYYY-MM-DDTHH:mm`, seconds optional — exactly what `<input type="datetime-local">` submits. */
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/;

/** Does this string already say which zone it is in? */
function hasZoneSuffix(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

/** Milliseconds ahead of UTC, as the `+05:30` an ISO string carries. */
function formatOffset(ms: number): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const minutes = Math.abs(Math.round(ms / 60_000));
  return `${ms < 0 ? '-' : '+'}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * A wall-clock date and time, plus the zone it was read in, as a full ISO string.
 *
 * `<input type="datetime-local">` submits `2026-08-14T17:45` — no seconds and, more to the
 * point, no offset. Every event schema wants `z.string().datetime({ offset: true })`, so that
 * value is not storable, and the event edit form was handing it straight to the validator: a
 * date change failed with "No changes detected" or an opaque validation error, which is why
 * the only way to fix a wrong date looked like deleting the event.
 *
 * The wall clock is preserved exactly — 5:45 PM stays 5:45 PM — and only the offset is
 * computed, so this cannot silently shift a time the way re-parsing through UTC would.
 * A string that already names its zone is returned untouched.
 */
export function zonedDateTimeToIso(local: string, timeZone: string): string {
  if (hasZoneSuffix(local)) return local;

  const match = LOCAL_DATE_TIME.exec(local);
  if (!match) {
    throw new Error(`Not a local date-time: ${local}`);
  }
  const wallClock = `${match[1]}T${match[2]}${match[3] ?? ':00'}`;

  const asUtc = Date.parse(`${wallClock}Z`);
  if (Number.isNaN(asUtc)) {
    throw new Error(`Not a real date-time: ${local}`);
  }

  // Corrected twice, for the reason `startOfDayInstant` gives: the first offset is read at the
  // wrong instant, which lands in the wrong DST period roughly twice a year.
  const firstPass = asUtc - offsetMs(asUtc, timeZone);
  const instant = asUtc - offsetMs(firstPass, timeZone);

  return `${wallClock}${formatOffset(offsetMs(instant, timeZone))}`;
}

/**
 * The other half of the round trip: what to put in an `<input type="datetime-local">`.
 *
 * Slicing the first 16 characters off a stored string is only right when that string happens
 * to be local-with-offset. On a value stored as UTC it shows the UTC wall clock, so an editor
 * who saves the form without touching the field moves the concert by the whole offset — five
 * and a half hours, here. Reading it through the zone makes the pair exact for both shapes.
 */
export function zonedDateTimeInputValue(iso: string, timeZone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`Not a real date-time: ${iso}`);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find(p => p.type === type)?.value ?? '';

  // As in `offsetMs`: `hour12: false` renders midnight as hour 24 in some ICU versions.
  const hour = String(Number(part('hour')) % 24).padStart(2, '0');

  return `${part('year')}-${part('month')}-${part('day')}T${hour}:${part('minute')}`;
}

/**
 * The instant at which this calendar date begins in this zone.
 *
 * Used to turn a `sessionDate` back into a comparable point in time — an auto-confirm
 * deadline has to be an instant, because the cron that reads it runs in UTC.
 */
export function startOfDayInstant(dateOnly: string, timeZone: string): string {
  const asUtc = parseDateOnly(dateOnly);
  // Correct twice. The first offset is read at the wrong instant (midnight UTC rather than
  // midnight local), which lands in the wrong DST period roughly twice a year; re-reading it
  // at the corrected instant settles it.
  const firstPass = asUtc - offsetMs(asUtc, timeZone);
  const secondPass = asUtc - offsetMs(firstPass, timeZone);
  return new Date(secondPass).toISOString();
}
