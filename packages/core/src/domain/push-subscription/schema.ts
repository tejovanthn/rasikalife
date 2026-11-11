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

/**
 * The push services browsers use. The server POSTs to a stored endpoint, so an endpoint is
 * limited to these hosts (exact match, or a subdomain for the wildcard entries). Anything else
 * would let a user aim the server at an internal address (SSRF).
 */
const PUSH_HOSTS = [
  { host: 'fcm.googleapis.com', subdomains: false },
  { host: 'push.apple.com', subdomains: true },
  { host: 'updates.push.services.mozilla.com', subdomains: false },
  { host: 'notify.windows.com', subdomains: true },
] as const;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some(
    entry => (entry.subdomains ? host.endsWith(`.${entry.host}`) : host === entry.host)
  );
}
