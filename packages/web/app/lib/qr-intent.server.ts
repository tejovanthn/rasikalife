import { BulkSetFollowSchema } from '@rasika/core/domain/follow/client';
import {
  QR_INTENT_COOKIE,
  QR_INTENT_TTL_SEC,
  QrCodeSchema,
} from '@rasika/core/domain/venue-qr/client';
import { createCookie } from 'react-router';
import { Resource } from 'sst';
import { z } from 'zod';

/**
 * `qr_intent`: what a signed-out scanner chose, kept across Google sign-in.
 *
 * Signed with the `QrIntentSecret` SST secret (react-router's cookie signing, HMAC-SHA256), and
 * the payload carries its own `exp`, since a cookie's `Max-Age` is only a browser's promise.
 * `HttpOnly`, `SameSite=Lax` (the return from Google is a top-level GET, which Lax sends).
 * Host-only on rasika.life: no other app reads it.
 *
 * CloudFront forwards only whitelisted cookies to the origin (infra/site.ts), so `qr_intent` is
 * on that list or the callback would never see it. /q is `no-store`, so the cookie never
 * changes what a cached page shows; it only splits the cache key for 15 minutes for a reader
 * who is mid sign-in.
 */
const IntentSchema = z.object({
  code: QrCodeSchema,
  eventId: z.string().optional(),
  // The same shape `follow.bulkSet` takes, so a tampered or stale cookie fails the same checks.
  targets: BulkSetFollowSchema.shape.targets,
  exp: z.number(),
});

export type QrIntent = Omit<z.infer<typeof IntentSchema>, 'exp'>;

export function createQrIntentCookie(
  secret: string,
  secure = process.env.NODE_ENV === 'production'
) {
  return createCookie(QR_INTENT_COOKIE, {
    secrets: [secret],
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: QR_INTENT_TTL_SEC,
  });
}

type IntentCookie = ReturnType<typeof createQrIntentCookie>;

function secret(): string {
  try {
    return Resource.QrIntentSecret.value;
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
    return 'dev-qr-intent-secret';
  }
}

let cached: IntentCookie | undefined;
function defaultCookie(): IntentCookie {
  cached ??= createQrIntentCookie(secret());
  return cached;
}

/** `Set-Cookie` value that stores the intent. */
export async function serializeQrIntent(
  intent: QrIntent,
  now: number = Date.now(),
  cookie: IntentCookie = defaultCookie()
): Promise<string> {
  return cookie.serialize({ ...intent, exp: now + QR_INTENT_TTL_SEC * 1000 });
}

/** The intent from a request, or `null` when missing, tampered with, malformed or expired. */
export async function readQrIntent(
  request: Request,
  now: number = Date.now(),
  cookie: IntentCookie = defaultCookie()
): Promise<QrIntent | null> {
  const header = request.headers.get('Cookie');
  if (!header || !header.includes(`${QR_INTENT_COOKIE}=`)) return null;
  const raw = await cookie.parse(header);
  const parsed = IntentSchema.safeParse(raw);
  if (!parsed.success || parsed.data.exp <= now) return null;
  const { exp: _exp, ...intent } = parsed.data;
  return intent;
}

/** `Set-Cookie` value that removes it. */
export async function clearQrIntent(cookie: IntentCookie = defaultCookie()): Promise<string> {
  return cookie.serialize('', { maxAge: 0, expires: new Date(0) });
}
