import { invalidateSiteCache } from '@rasika/core/site-cache';

/**
 * Routers whose writes never change a page on rasika.life. `classes` serves
 * classes.rasika.life, which caches nothing; `concertLog` is the signed-in reader's own
 * "my concerts"; `user` holds preferences and roles; `shortLink` adds `/l/` redirects, which
 * no page shows, and is called while a page renders, so clearing on it would empty the cache
 * from inside a cache miss. `rsvp` is not here: the event page shows the count. `notify` holds
 * a user's own preferences and WhatsApp number. `qr` and `space` are here since phase 4: the scan
 * page is `no-store`, and the only place a code shows on a cached page is the venue QR panel,
 * which renders for moderators only and so sits in a private document. Assigning 50 stickers on
 * site would otherwise clear the whole CDN 50 times. `qr.resolve` is a query and never clears.
 */
const PRIVATE_ROUTERS = new Set([
  'classes',
  'concertLog',
  'user',
  'shortLink',
  'notify',
  'qr',
  'space',
]);

/**
 * Single procedures, inside a router that is otherwise public, that change no page we clear
 * for. `follow.toggle` and `follow.bulkSet` move `followerCount`, which cached venue, organiser
 * and artist pages show. They are here on purpose: a concert with hundreds of QR follows would
 * purge the whole CDN hundreds of times. The cost is that the public count can lag until the
 * next clear (at most a week). `follow.setShare` changes only the follower's own flag.
 * `partner` is not
 * private either: `updateProfile`, `createEvent`, `updateEvent` and `setEventReview` change
 * public pages, and the Verified badge is stored data that those pages read.
 */
const PRIVATE_PATHS = new Set([
  'follow.toggle',
  'follow.bulkSet',
  'follow.setShare',
  // Dashboard access and files change no public page. `partner.acceptInvites` clears the cache
  // itself, and only when an owner was accepted (that turns the Verified badge on).
  'partner.invite',
  'partner.revoke',
  'partner.exportFollowers',
  'partner.acceptInvites',
]);

/** Whether a finished call may have changed a public page, so the CDN copy must go. */
export function changesPublicPage(type: string, path: string, ok: boolean): boolean {
  if (type !== 'mutation' || !ok) return false;
  if (PRIVATE_PATHS.has(path)) return false;
  return !PRIVATE_ROUTERS.has(path.split('.')[0] ?? '');
}

/**
 * Clears the site's CloudFront cache after a mutation that may have changed a public page.
 * Signed-out pages are cached for a week (packages/web/app/lib/page-cache.ts), so without this
 * an edit stays invisible to them until the copy expires.
 *
 * Awaited, not fired and forgotten: Lambda can freeze the container as soon as the response is
 * sent. `invalidateSiteCache` never throws, so a failure costs freshness, not the write.
 */
export async function clearSiteCacheAfterMutation<T extends { ok: boolean }>({
  type,
  path,
  next,
}: { type: string; path: string; next: () => Promise<T> }): Promise<T> {
  const result = await next();
  if (changesPublicPage(type, path, result.ok)) {
    await invalidateSiteCache(`tRPC ${path}`);
  }
  return result;
}
