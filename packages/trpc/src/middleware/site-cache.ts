import { invalidateSiteCache } from '@rasika/core/site-cache';

/**
 * Routers whose writes never change a page on rasika.life. `classes` serves
 * classes.rasika.life, which caches nothing; `concertLog` is the signed-in reader's own
 * "my concerts"; `user` holds preferences and roles; `shortLink` adds `/l/` redirects, which
 * no page shows, and is called while a page renders, so clearing on it would empty the cache
 * from inside a cache miss. `rsvp` is not here: the event page shows the count.
 */
const PRIVATE_ROUTERS = new Set(['classes', 'concertLog', 'user', 'shortLink']);

/** Whether a finished call may have changed a public page, so the CDN copy must go. */
export function changesPublicPage(type: string, path: string, ok: boolean): boolean {
  if (type !== 'mutation' || !ok) return false;
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
