import { z } from 'zod';
import { zonedDateTimeToIso } from '../../shared/timezone';
import { DEFAULT_TIMEZONE } from './constants';
import { QrCodeSchema } from './schema';

/**
 * "Add a concert happening here": the short form behind the scan page link. Pure, so the rules
 * are tested without a table.
 */
export const AddConcertSchema = z.object({
  code: QrCodeSchema,
  title: z.string().trim().min(1).max(300),
  /** `YYYY-MM-DD`, the day at the hall. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** `HH:mm` on the hall's wall clock. */
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
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
 * A viewer, a member of another organiser, or an unverified organiser goes to review.
 */
export function mayAutoApprove(
  membership: { role: string } | null | undefined,
  organiser: { verifiedAt?: string | null } | null | undefined
): boolean {
  return membership?.role === 'owner' && Boolean(organiser?.verifiedAt);
}
