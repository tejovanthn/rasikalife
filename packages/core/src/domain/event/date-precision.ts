/**
 * How much of an event's date is known.
 *
 * Old performances added to an artist's profile are often known by year alone. `startDateTime`
 * keys five indexes and cannot be blank or partial, so a year-only event stores a placeholder
 * instant and `datePrecision: 'year'` says that only its year is a fact. Anything that prints an
 * event's date must check it, or it publishes a day nobody recorded.
 *
 * `exact` is stored rather than the attribute removed, so that a date supplied later overwrites
 * `year` through an ordinary `.set()` (rule 8). A missing value means exact.
 *
 * Browser-safe, no imports.
 */
export const EVENT_DATE_PRECISIONS = ['exact', 'year'] as const;
export type EventDatePrecision = (typeof EVENT_DATE_PRECISIONS)[number];

export const MIN_EVENT_YEAR = 1900;

interface Dated {
  startDateTime: string;
  datePrecision?: string | null;
}

export function isYearOnly(event: { datePrecision?: string | null }): boolean {
  return event.datePrecision === 'year';
}

/**
 * The placeholder: noon in India on 1 January. Noon keeps the year the same in UTC and in India.
 * January keeps the current year in the past, so it never lists as an upcoming concert.
 */
export function yearOnlyStart(year: number): string {
  return `${String(year).padStart(4, '0')}-01-01T06:30:00.000Z`;
}

/** A year-only event is something that happened, so a future year is refused. */
export function isEventYear(year: number, now: Date = new Date()): boolean {
  return Number.isInteger(year) && year >= MIN_EVENT_YEAR && year <= now.getUTCFullYear();
}

/** `2019` for a year-only event, otherwise undefined: the caller formats the full date. */
export function eventYearLabel(event: Dated): string | undefined {
  return isYearOnly(event) ? event.startDateTime.slice(0, 4) : undefined;
}

/** Puts any year-only start on the placeholder, so no real-looking day is stored beside it. */
export function normaliseStart<T extends { startDateTime?: string; datePrecision?: string | null }>(
  input: T
): T {
  if (!isYearOnly(input) || !input.startDateTime) return input;
  return { ...input, startDateTime: yearOnlyStart(Number(input.startDateTime.slice(0, 4))) };
}

/**
 * The precision an update leaves the event with. An update that moves a year-only event to
 * another instant and says nothing about precision has supplied a real date. Comparing instants
 * rather than strings matters: a form that echoes the placeholder back writes it with an offset.
 */
export function precisionAfterUpdate(
  current: Dated,
  update: { startDateTime?: string | null; datePrecision?: EventDatePrecision | null }
): EventDatePrecision | undefined {
  if (update.datePrecision) return update.datePrecision;
  const moved =
    !!update.startDateTime &&
    Date.parse(update.startDateTime) !== Date.parse(current.startDateTime);
  if (isYearOnly(current)) return moved ? 'exact' : 'year';
  return (current.datePrecision as EventDatePrecision | null | undefined) ?? undefined;
}
