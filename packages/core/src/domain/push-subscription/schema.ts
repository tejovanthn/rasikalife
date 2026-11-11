import { z } from 'zod';
import { ErrorCode } from '../../constants';

export const PUSH_ERROR_CODES = {
  PUSH_SUBSCRIPTION_INVALID: ErrorCode.PUSH_SUBSCRIPTION_INVALID,
} as const;

export const SubscribePushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const UnsubscribePushSchema = z.object({ endpoint: z.string().url() });

export type SubscribePushInput = z.infer<typeof SubscribePushSchema>;
