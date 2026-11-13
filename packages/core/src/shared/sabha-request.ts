import { z } from 'zod';
import { WhatsappNumberSchema } from '../domain/user/schema';

/**
 * What a sabha secretary sends from `rasika.life/for-sabhas`. Browser-safe: the web form and the
 * tRPC mutation parse the same shape. Nothing is stored; it becomes one email to the team.
 *
 * `whatsapp` is the ten national digits (`WhatsappNumberSchema`, the same rule as the reader's
 * own number). The web form tolerates `+91`, spaces and a leading 0 before it gets here.
 */
export const SABHA_REQUEST_LIMITS = {
  venueName: 120,
  contactName: 100,
  role: 80,
  concertDates: 500,
} as const;

export const SabhaRequestSchema = z.object({
  venueName: z.string().trim().min(1).max(SABHA_REQUEST_LIMITS.venueName),
  contactName: z.string().trim().min(1).max(SABHA_REQUEST_LIMITS.contactName),
  role: z.string().trim().max(SABHA_REQUEST_LIMITS.role).optional(),
  whatsapp: WhatsappNumberSchema,
  concertDates: z.string().trim().max(SABHA_REQUEST_LIMITS.concertDates).optional(),
});

export type SabhaRequest = z.infer<typeof SabhaRequestSchema>;

/** Five requests per client address per hour. */
export const SABHA_REQUEST_LIMIT_PER_HOUR = 5;
