import { z } from 'zod';
import { zonedDateTimeToIso } from '../../shared/timezone';
import { DEFAULT_TIMEZONE } from './constants';
import { QrCodeSchema } from './schema';

/** True for a real calendar day: `2026-02-31` and `2026-13-01` are not. */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** True for `HH:mm` on a 24 hour clock. */
export function isRealTime(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(m) && Number(m?.[1]) < 24 && Number(m?.[2]) < 60;
}

/** `YYYY-MM-DD`, the day at the hall, checked against the calendar. */
export const CalendarDateSchema = z
  .string()
  .refine(isRealDate, { message: 'Enter a real date (YYYY-MM-DD)' });

/** `HH:mm` on the hall's wall clock. */
export const ClockTimeSchema = z
  .string()
  .refine(isRealTime, { message: 'Enter a real time (HH:mm)' });

/**
 * "Add a concert happening here": the short form behind the scan page link. Pure, so the rules
 * are tested without a table.
 */
export const AddConcertSchema = z.object({
  code: QrCodeSchema,
  title: z.string().trim().min(1).max(300),
  /** `YYYY-MM-DD`, the day at the hall. */
  date: CalendarDateSchema,
  /** `HH:mm` on the hall's wall clock. */
  startTime: ClockTimeSchema,
  spaceId: z.string().optional(),
  organiserName: z.string().trim().max(200).optional(),
  /** Free text, one name per line or comma-separated. */
  artists: z.string().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type AddConcertInput = z.infer<typeof AddConcertSchema>;

/** `a, b\nc` becomes three billed artists; empty names are dropped, at most 12. */
export function parseArtistNames(text?: string): Array<{ name: string }> {
  return (text ?? '')
    .split(/[\n,]/)
    .map(n => n.replace(/\s+/g, ' ').trim())
    .filter(n => n.length > 0)
    .slice(0, 12)
    .map(name => ({ name }));
}

/** The stored start instant, with the offset of the hall's zone. */
export function concertStart(date: string, startTime: string, zone = DEFAULT_TIMEZONE): string {
  return zonedDateTimeToIso(`${date}T${startTime}`, zone);
}

/**
 * Auto-approval: only an owner grant on that organiser, and only once the organiser is verified.
 * A viewer, a member of another organiser, or an unverified organiser goes to review. So does
 * an organiser a moderator has put on review (`requireEventReview`, phase 8).
 */
export function mayAutoApprove(
  membership: { role: string } | null | undefined,
  organiser: { verifiedAt?: string | null; requireEventReview?: boolean | null } | null | undefined
): boolean {
  return (
    membership?.role === 'owner' && Boolean(organiser?.verifiedAt) && !organiser?.requireEventReview
  );
}
