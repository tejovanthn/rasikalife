import { hitRateLimit } from '@rasika/core/shared/rate-limit';
import {
  SABHA_REQUEST_LIMIT_PER_HOUR,
  SabhaRequestSchema,
} from '@rasika/core/shared/sabha-request';
import { z } from 'zod';
import { sendSabhaRequestEmail } from '../sabha-request-email';
import { createTRPCRouter, publicProcedure } from '../trpc';

const SubmitInputSchema = SabhaRequestSchema.extend({
  /** The honeypot. A person never sees this field, so any value means a script filled it. */
  website: z.string().max(500).optional(),
  /** The visitor's address, set by the web server from the edge. Same as `qr.resolve`. */
  clientIp: z.string().min(1).max(45).optional(),
});

export type SabhaRequestStatus = 'sent' | 'rate-limited' | 'failed';

/**
 * `submit` is public: a sabha secretary has no account. It never throws for an ordinary
 * outcome. A filled honeypot answers `sent` and sends nothing, so a script learns nothing.
 * Nothing is stored. A caller of the public tRPC URL can lie about `clientIp`; that only
 * changes which bucket their own requests land in, and `hitRateLimit` fails open.
 */
export const sabhaRequestRouter = createTRPCRouter({
  submit: publicProcedure
    .input(SubmitInputSchema)
    .mutation(async ({ input }): Promise<{ status: SabhaRequestStatus }> => {
      const { website, clientIp, ...request } = input;
      if (website?.trim()) return { status: 'sent' };
      if (clientIp) {
        const { allowed } = await hitRateLimit({
          key: `sabha-request-ip#${clientIp}`,
          limit: SABHA_REQUEST_LIMIT_PER_HOUR,
          windowSec: 3600,
        });
        if (!allowed) return { status: 'rate-limited' };
      }
      return { status: (await sendSabhaRequestEmail(request)) ? 'sent' : 'failed' };
    }),
});
