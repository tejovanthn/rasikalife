import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';
import { clearQrIntent, readQrIntent } from '~/lib/qr-intent.server';
import { doneHref, rowKey } from '~/lib/qr-scan';

/**
 * The sign-in return, for a scanner who chose things signed out (`qr_intent`).
 *
 * `finishQrIntent` applies the choices with the new access token (the request holds no session
 * yet) and says where to land and which `Set-Cookie` to add. A missing, tampered or expired
 * cookie returns `null`: the callback then sends the reader back to `/q/{code}` through the
 * ordinary `post_login_redirect`, and only the ticks are lost. A failed save keeps the cookie so
 * the scan page can put the ticks back.
 */
export async function finishQrIntent(
  request: Request,
  accessToken: string
): Promise<{ location: string; setCookie?: string } | null> {
  const intent = await readQrIntent(request);
  if (!intent) return null;

  const client = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: Resource.RasikaTRPC.url,
        headers: () => ({ Authorization: `Bearer ${accessToken}` }),
      }),
    ],
  });
  try {
    await client.follow.bulkSet.mutate({
      qrCode: intent.code,
      eventId: intent.eventId,
      targets: intent.targets,
    });
  } catch (error) {
    console.error('Failed to apply qr_intent:', error);
    return { location: `/q/${intent.code}?error=save` };
  }
  return {
    location: doneHref(
      intent.code,
      intent.eventId,
      intent.targets.filter(t => t.follow).map(t => rowKey(t.type, t.id))
    ),
    setCookie: await clearQrIntent(),
  };
}

/** Google sent the reader back with an error: to the scan page with the cancelled message. */
export async function cancelledQrLocation(request: Request): Promise<string | null> {
  const intent = await readQrIntent(request);
  return intent ? `/q/${intent.code}?signin=cancelled` : null;
}
