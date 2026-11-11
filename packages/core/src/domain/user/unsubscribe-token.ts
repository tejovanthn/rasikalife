import { randomBytes } from 'node:crypto';

/** 192 bits, URL-safe. The HMAC that wraps it in a link is built by the sender (phase 5). */
export function newUnsubscribeToken(): string {
  return randomBytes(24).toString('base64url');
}
