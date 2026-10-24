import { addDaysToDate } from '@rasika/core/shared/timezone';
import { eventDateKey, formatDayLabel } from '~/lib/event-time';

/**
 * The filters on the event listings: a date preset, a month or a day, "Free only", a city and
 * the sort.
 * Every one is a query parameter, so the page is server-rendered, works without JavaScript,
 * and CloudFront caches each combination (its policy keys on every query string).
 *
 * Dates are `YYYY-MM-DD` in India time, the zone every listing is filtered in. An event's own
 * day is read in its own zone (`eventDateKey`), so a Sunnyvale concert lands on its local day.
 */

export type DatePreset = 'today' | 'weekend' | 'week';

export const DATE_PRESETS: ReadonlyArray<{ value: DatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'week', label: 'This week' },
];

export interface DateRange {
  /** Inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive, `YYYY-MM-DD`. */
  to: string;
  label: string;
  /** What `when` was, normalised, for links and the canonical. */
  when: string;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 0 = Sunday … 6 = Saturday. */
function weekday(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00Z`).getUTCDay();
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function formatMonthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The range a `when` parameter names, from `today`. `null` for anything unrecognised, which the
 * page treats as "all upcoming" rather than an error, since these URLs get shared and mangled.
 *
 * The weekend is the coming Saturday and Sunday; on a Saturday it is today and tomorrow, and on
 * a Sunday it is today alone. The week runs from today to Sunday.
 */
export function resolveDateRange(when: string | null | undefined, today: string): DateRange | null {
  if (!when) return null;
  const day = weekday(today);

  if (when === 'today') return { from: today, to: today, label: 'Today', when };

  if (when === 'weekend') {
    const saturday = day === 0 ? today : addDaysToDate(today, 6 - day);
    const sunday = day === 0 ? today : addDaysToDate(saturday, 1);
    return { from: saturday, to: sunday, label: 'This weekend', when };
  }

  if (when === 'week') {
    const sunday = addDaysToDate(today, (7 - day) % 7);
    return { from: today, to: sunday, label: 'This week', when };
  }

  if (MONTH.test(when)) {
    return { from: `${when}-01`, to: lastDayOfMonth(when), label: formatMonthLabel(when), when };
  }

  if (DAY.test(when) && when <= lastDayOfMonth(when.slice(0, 7))) {
    return { from: when, to: when, label: formatDayLabel(when), when };
  }

  return null;
}

export interface ListingFilters {
  range?: DateRange | null;
  free?: boolean;
  citySlug?: string;
}

interface Filterable {
  startDateTime: string;
  timezone?: string | null;
  entryType?: string | null;
  citySlug?: string;
}

/**
 * "Free only" keeps `entryType === 'free'` and nothing else: an event with no entry type is
 * unknown, not free, and promising a free concert that charges is the worse mistake.
 */
export function filterEvents<T extends Filterable>(events: T[], filters: ListingFilters): T[] {
  const { range, free, citySlug } = filters;
  return events.filter(event => {
    if (free && event.entryType !== 'free') return false;
    if (citySlug && event.citySlug !== citySlug) return false;
    if (range) {
      const day = eventDateKey(event);
      if (day < range.from || day > range.to) return false;
    }
    return true;
  });
}

/** How many events fall on each day, for the calendar. */
export function dayCounts(events: Filterable[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const day = eventDateKey(event);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

/** The last month holding an event, `YYYY-MM`, or `null` when nothing is listed. */
export function lastEventMonth(counts: Record<string, number>): string | null {
  const days = Object.keys(counts).sort();
  return days.length > 0 ? (days.at(-1) as string).slice(0, 7) : null;
}

/**
 * The month the calendar shows when the reader has not browsed it: the month the chosen range
 * starts in, else the current one.
 */
export function defaultCalendarMonth(range: DateRange | null, today: string): string {
  return (range?.from ?? today).slice(0, 7);
}

/**
 * The month the calendar shows. `cal` is the reader browsing with the arrows, kept apart from
 * `when` so that looking at December does not empty the list of October's concerts. It is held
 * between the current month and the last one with an event, the same bounds the arrows stop at,
 * so a hand-typed `cal=2030-01` cannot strand the reader on blank months.
 */
export function calendarMonth(
  cal: string | null | undefined,
  range: DateRange | null,
  today: string,
  lastMonth: string | null
): string {
  if (!cal) return defaultCalendarMonth(range, today);
  const thisMonth = today.slice(0, 7);
  const last = lastMonth && lastMonth > thisMonth ? lastMonth : thisMonth;
  if (cal < thisMonth) return thisMonth;
  if (cal > last) return last;
  return cal;
}

/**
 * The days a preset covers, for its heading: "Sat, 24 Oct – Sun, 25 Oct", or one day alone.
 * A month or a single day already names its dates in its label, so those get nothing.
 */
export function rangeDates(range: DateRange): string | undefined {
  if (!DATE_PRESETS.some(p => p.value === range.when)) return undefined;
  return range.from === range.to
    ? formatDayLabel(range.from)
    : `${formatDayLabel(range.from)} – ${formatDayLabel(range.to)}`;
}

/**
 * "Nearest first": events by straight-line distance, those with no distance last and in date
 * order (the sort is stable and the input is in start order).
 */
export function sortByDistance<T extends { distanceKm?: number }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
  );
}

/**
 * Runs of consecutive events on the same day, keeping the order given. For the nearest-first
 * list: every card still sits under a date header, which is where `EventDayGroup` shows the
 * date, but the order stays strictly by distance. A day can appear twice when a nearer concert
 * on another day falls between two of its own; grouping whole days instead would put a far
 * concert ahead of a near one, which is the one thing this sort promises not to do.
 */
export function groupConsecutiveByDate<T extends Filterable>(
  events: T[]
): Array<{ date: string; events: T[] }> {
  const groups: Array<{ date: string; events: T[] }> = [];
  for (const event of events) {
    const date = eventDateKey(event);
    const last = groups.at(-1);
    if (last && last.date === date) last.events.push(event);
    else groups.push({ date, events: [event] });
  }
  return groups;
}

/** A Monday-first grid of a month, `null` padding the first and last weeks. */
export function monthGrid(month: string): Array<Array<string | null>> {
  const first = `${month}-01`;
  const last = lastDayOfMonth(month);
  const lead = (weekday(first) + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = first; d <= last; d = addDaysToDate(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Where a listing lives. The date presets of the whole listing are pages of their own
 * (`/events/today`, `/events/this-weekend`, `/events/this-week`); a city page carries every
 * filter, presets included, as a query parameter. Per-city date pages were dropped: Keyword
 * Planner shows no searches for "… in bangalore this weekend" (Oct 2026).
 */
export type ListingScope = { kind: 'all' } | { kind: 'city'; slug: string };

export interface ListingState {
  when?: string | null;
  free?: boolean;
  view?: 'whatsapp' | null;
  /** WhatsApp text: performers line. On unless `false`. */
  cast?: boolean;
  /** WhatsApp text: a link per event. */
  links?: boolean;
  /** "Nearest first", offered only to a reader with a saved home location. */
  sort?: 'near' | null;
  /**
   * The month the calendar is browsed to, `YYYY-MM`. Display only: `filterEvents` never reads
   * it, so the arrows move the calendar and leave the list alone.
   */
  cal?: string | null;
}

export const PRESET_SEGMENTS: Readonly<Record<DatePreset, string>> = {
  today: 'today',
  weekend: 'this-weekend',
  week: 'this-week',
};

export function presetFromSegment(segment: string): DatePreset | undefined {
  return (Object.keys(PRESET_SEGMENTS) as DatePreset[]).find(p => PRESET_SEGMENTS[p] === segment);
}

export function listingHref(scope: ListingScope, state: ListingState): string {
  const query = new URLSearchParams();
  let path = '/events';
  const preset = DATE_PRESETS.find(p => p.value === state.when)?.value;

  if (scope.kind === 'city') {
    path = `/${scope.slug}/concerts`;
    if (state.when) query.set('when', state.when);
  } else if (preset) {
    path = `/events/${PRESET_SEGMENTS[preset]}`;
  } else if (state.when) {
    query.set('when', state.when);
  }

  if (state.free) query.set('free', '1');
  if (state.sort === 'near') query.set('sort', 'near');
  if (state.view === 'whatsapp') {
    query.set('view', 'whatsapp');
    if (state.cast === false) query.set('cast', '0');
    if (state.links) query.set('links', '1');
  }
  if (state.cal) query.set('cal', state.cal);
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The state a listing URL describes. `presetSegment` is the `/events/<preset>` path segment.
 * Anything else in the query, such as `pin_error` from a failed location save, is not state:
 * `listingHref` never writes it back, so it drops off the first link the reader follows.
 */
export function readListingState(url: URL, presetSegment?: string): ListingState {
  const p = url.searchParams;
  return {
    when: (presetSegment && presetFromSegment(presetSegment)) || p.get('when'),
    free: p.get('free') === '1',
    view: p.get('view') === 'whatsapp' ? 'whatsapp' : null,
    cast: p.get('cast') !== '0',
    links: p.get('links') === '1',
    sort: p.get('sort') === 'near' ? 'near' : null,
    cal: MONTH.test(p.get('cal') ?? '') ? p.get('cal') : null,
  };
}
