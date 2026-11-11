import { toCsv } from '../../admin/csv';
/**
 * Pure rules for the sabha dashboard: follower numbers, the export file, profile diffs and the
 * event split. No table, no clock (`now` is passed in), so every rule is tested on its own.
 * Loaders that read the table are in `dashboard.ts`.
 */
import { addDaysToDate, dateInTimeZone } from '../../shared/timezone';
import { DEFAULT_TIMEZONE } from '../venue-qr/constants';

/** The exact header row of the follower export (Copy, "CSV columns"). */
export const EXPORT_HEADER = [
  'name',
  'email',
  'whatsapp_number',
  'whatsapp_verified',
  'followed_at',
  'source',
  'followed',
] as const;

export type FollowerRow = {
  userId: string;
  targetType: 'venue' | 'organiser' | 'artist';
  source: 'qr' | 'web';
  shareWithTarget?: boolean | null;
  shareWithdrawnAt?: string | null;
  createdAt: string;
};

export type ExportUser = {
  id: string;
  name: string;
  email: string;
  whatsappNumber?: string | null;
  whatsappVerifiedAt?: string | null;
};

/** A calendar date in IST, `YYYY-MM-DD`. Months and days on the dashboard are IST ones. */
export function istDate(instant: Date | string): string {
  return dateInTimeZone(instant, DEFAULT_TIMEZONE);
}

/** `YYYY-MM`, in IST. */
export function istMonth(instant: Date | string): string {
  return istDate(instant).slice(0, 7);
}

export type FollowerStats = {
  total: number;
  /** Followers who started following in the current IST month. */
  newThisMonth: number;
  /** Followers who share their details with this target right now. */
  sharing: number;
  /** Followers who switched sharing off in the current IST month. A count, never names. */
  stoppedSharingThisMonth: number;
};

export function followerStats(follows: FollowerRow[], now: Date): FollowerStats {
  const month = istMonth(now);
  let newThisMonth = 0;
  let sharing = 0;
  let stopped = 0;
  for (const follow of follows) {
    if (istMonth(follow.createdAt) === month) newThisMonth += 1;
    if (follow.shareWithTarget === true) sharing += 1;
    // A follow that is sharing again has no `shareWithdrawnAt` (it is removed on re-grant), so
    // this counts only people who are still not sharing.
    if (follow.shareWithdrawnAt && istMonth(follow.shareWithdrawnAt) === month) stopped += 1;
  }
  return { total: follows.length, newThisMonth, sharing, stoppedSharingThisMonth: stopped };
}

export type TrendPoint = { date: string; newFollowers: number; total: number };

/**
 * The last `days` IST days, oldest first. `total` is the followers who followed on or before
 * that day and still follow, so an unfollow lowers every day's total, not just today's.
 * The trend is read from the follows that exist: it is a view of today's followers, not a log.
 */
export function followerTrend(follows: FollowerRow[], now: Date, days = 30): TrendPoint[] {
  const today = istDate(now);
  const perDay = new Map<string, number>();
  for (const follow of follows) {
    const date = istDate(follow.createdAt);
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
  }
  const first = addDaysToDate(today, -(days - 1));
  let total = 0;
  for (const [date, count] of perDay) if (date < first) total += count;

  const points: TrendPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDaysToDate(first, i);
    const newFollowers = perDay.get(date) ?? 0;
    total += newFollowers;
    points.push({ date, newFollowers, total });
  }
  return points;
}

/** A cell that starts with one of these is read as a formula by Excel and Sheets. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Names and emails come from sign-in, so they are not ours to trust in a spreadsheet. A leading
 * `'` makes the cell text. The WhatsApp number is built here and is not passed through this.
 */
export function neutralizeCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** `+91` plus the stored 10 national digits. */
export function whatsappExportNumber(stored?: string | null): string {
  return stored ? `+91${stored}` : '';
}

export type ExportRow = string[];

/**
 * The export rows for one target. Only follows with `shareWithTarget === true` are read, so a
 * withdrawn follower is gone from the next file, and a user the table no longer holds is
 * skipped. `whatsapp_verified` is `Yes` or `Unverified`, blank when there is no number.
 * `followed_at` is the IST date, `2026-11-16`. Oldest follow first.
 */
export function buildExportRows(
  follows: FollowerRow[],
  users: Map<string, ExportUser>,
  targetType: 'venue' | 'organiser'
): ExportRow[] {
  return [...follows]
    .filter(follow => follow.shareWithTarget === true)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap(follow => {
      const user = users.get(follow.userId);
      if (!user) return [];
      const number = whatsappExportNumber(user.whatsappNumber);
      return [
        [
          neutralizeCell(user.name),
          neutralizeCell(user.email),
          number,
          number ? (user.whatsappVerifiedAt ? 'Yes' : 'Unverified') : '',
          istDate(follow.createdAt),
          follow.source,
          targetType,
        ],
      ];
    });
}

export function buildFollowersCsv(rows: ExportRow[]): string {
  return toCsv([[...EXPORT_HEADER], ...rows]);
}

/** `exports/{targetType}/{targetId}/{timestamp}.csv`, the timestamp as `20261116T093000Z`. */
export function exportKey(targetType: string, targetId: string, now: Date): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return `exports/${targetType}/${targetId}/${stamp}.csv`;
}

/**
 * Which fields of a profile save actually changed, as before and after values, for
 * `ChangeHistory`. Compared as JSON, because an address or a link list is a new object on every
 * request and `!==` would call every save a change of every field.
 */
export function changedProfileFields(
  before: Record<string, unknown>,
  input: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const beforePart: Record<string, unknown> = {};
  const afterPart: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (JSON.stringify(before[field] ?? null) === JSON.stringify(value)) continue;
    beforePart[field] = before[field];
    afterPart[field] = value;
  }
  return { before: beforePart, after: afterPart };
}

type DatedEvent = { startDateTime: string; endDateTime?: string | null };

/**
 * Splits events into upcoming and past at `now`, by instant. A concert that has started but not
 * ended counts as upcoming, so it stays at the top of the list during the evening. Upcoming is
 * soonest first, past is latest first. Stored times carry their own offsets, so string order is
 * not time order.
 */
export function splitEventsByTime<T extends DatedEvent>(
  events: T[],
  now: Date
): { upcoming: T[]; past: T[] } {
  const at = now.getTime();
  const start = (e: T) => new Date(e.startDateTime).getTime();
  const end = (e: T) =>
    e.endDateTime ? new Date(e.endDateTime).getTime() : start(e) + 3 * 3600_000;
  const upcoming = events.filter(e => end(e) >= at).sort((a, b) => start(a) - start(b));
  const past = events.filter(e => end(e) < at).sort((a, b) => start(b) - start(a));
  return { upcoming, past };
}
