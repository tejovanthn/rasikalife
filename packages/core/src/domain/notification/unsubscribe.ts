/**
 * Unsubscribe links (decisions.md #3). The link carries `userId`, the kind and the user's
 * stored random `unsubscribeToken`, signed with an HMAC under `UnsubscribeSecret`.
 *
 * - The HMAC binds the kind, so a "digest" link cannot be edited into an "all" link.
 * - The stored token is rotated on use, so a used link, and every other link in the same
 *   email, stops working. A forwarded email cannot unsubscribe its new reader twice.
 * - The user id is in the link, so no index on the token is needed.
 *
 * Nothing here needs a session. Anyone holding the link can use it, which is the point: it works
 * from the inbox, signed out.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getUser, rotateUnsubscribeToken, setNotifyPrefs } from '../user';
import { UNSUBSCRIBE_KINDS } from './client';
import type { UnsubscribeKind } from './client';

export interface UnsubscribePayload {
  userId: string;
  kind: UnsubscribeKind;
  token: string;
}

function mac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** `<base64url payload>.<base64url hmac>`: URL-safe, no characters that need escaping. */
export function signUnsubscribeToken(payload: UnsubscribePayload, secret: string): string {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is unset');
  const body = Buffer.from(`${payload.userId}.${payload.kind}.${payload.token}`).toString(
    'base64url'
  );
  return `${body}.${mac(body, secret)}`;
}

/** The payload when the signature holds, else null. Does not look at the database. */
export function verifyUnsubscribeSignature(
  link: string,
  secret: string
): UnsubscribePayload | null {
  if (!secret) return null;
  const dot = link.lastIndexOf('.');
  if (dot < 1) return null;
  const body = link.slice(0, dot);
  if (!sameString(link.slice(dot + 1), mac(body, secret))) return null;
  const [userId, kind, ...rest] = Buffer.from(body, 'base64url').toString().split('.');
  const token = rest.join('.');
  if (!userId || !token || !UNSUBSCRIBE_KINDS.includes(kind as UnsubscribeKind)) return null;
  return { userId, kind: kind as UnsubscribeKind, token };
}

/** The signed link is real, and the user's stored token still matches. Reads only. */
export async function checkUnsubscribeToken(
  link: string,
  secret: string
): Promise<{ userId: string; kind: UnsubscribeKind } | null> {
  const payload = verifyUnsubscribeSignature(link, secret);
  if (!payload) return null;
  const user = await getUser(payload.userId);
  if (!user?.unsubscribeToken || !sameString(user.unsubscribeToken, payload.token)) return null;
  return { userId: payload.userId, kind: payload.kind };
}

/**
 * What each kind turns off. `reminders` clears `notifyReminder`, which stops push reminders
 * too, as Copy says. Turning push on sets it back (owner decision 16).
 */
export function unsubscribePatch(kind: UnsubscribeKind) {
  if (kind === 'digest') return { notifyDigest: false };
  if (kind === 'reminders') return { notifyReminder: false };
  return { notifyEmail: false };
}

/**
 * Applies the link: turns the thing off, then rotates the token. Returns the kind, or null for
 * a bad or used link. Safe to call from a one-click POST and from the confirm button alike.
 */
export async function unsubscribeWithToken(
  link: string,
  secret: string
): Promise<{ kind: UnsubscribeKind } | null> {
  const checked = await checkUnsubscribeToken(link, secret);
  if (!checked) return null;
  await setNotifyPrefs(checked.userId, unsubscribePatch(checked.kind));
  await rotateUnsubscribeToken(checked.userId);
  return { kind: checked.kind };
}
