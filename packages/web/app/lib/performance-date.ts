import {
  type EventDatePrecision,
  MIN_EVENT_YEAR,
  isEventYear,
  yearOnlyStart,
} from '@rasika/core/domain/event/client';

type PerformanceDate =
  | { startDateTime: string; datePrecision: EventDatePrecision }
  | { error: string };

/**
 * The year of a performance whose day is not known, from a form field. Event years run from
 * `MIN_EVENT_YEAR` to this year: such an entry is always about something that happened.
 */
export function readEventYear(raw: string, now: Date = new Date()): PerformanceDate {
  const year = /^\d{4}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!isEventYear(year, now)) {
    return { error: `Enter a year from ${MIN_EVENT_YEAR} to ${now.getUTCFullYear()}` };
  }
  return { startDateTime: yearOnlyStart(year), datePrecision: 'year' };
}

/** When a performance happened: a full date, or only its year. Exactly one is expected. */
export function readPerformanceDate(
  date: string,
  year: string,
  now: Date = new Date()
): PerformanceDate {
  if (date && year) return { error: 'Enter either the date or only the year, not both' };
  if (year) return readEventYear(year, now);
  if (!date) return { error: 'Enter the date, or only the year' };
  // Anchor a date-only input at MIDDAY IST, not midnight. Midnight IST is
  // 18:30 the previous UTC day, and the display paths slice the UTC string —
  // so the performance would show up a day early, and worse, render one day
  // on the UTC SSR Lambda and another in the IST browser. Noon IST is 06:30
  // UTC: the same calendar day in both zones, month boundaries included.
  const parsed = new Date(`${date}T12:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return { error: 'Invalid date' };
  return { startDateTime: parsed.toISOString(), datePrecision: 'exact' };
}
