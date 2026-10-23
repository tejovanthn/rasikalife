import { addDaysToDate, startOfDayInstant, todayInTimeZone } from '@rasika/core/shared/timezone';

/**
 * The Cache-Control a page gets when its route did not set one.
 *
 * Without this, no page outside the artist routes sent a Cache-Control at all, so CloudFront
 * cached nothing: every crawler hit ran the web Lambda and 2–3 tRPC Lambdas behind it, about
 * 850k invocations in the first ten days of Oct 2026, nearly all of them robots.
 *
 * Safe because CloudFront keys server responses on `rasika_session`, `theme` and
 * `script_preference` (the cache policy in infra/site.ts), the only cookies that change a
 * rendered page. A signed-in request still gets `private`, since the root loader writes the
 * viewer's name and email into every document. Anything that sets a cookie, or is not a plain
 * 200, is left alone.
 *
 * A week, because writes clear the cache themselves (`invalidateSiteCache`, from every public
 * tRPC mutation, the enrich cron and `pnpm cli reindex`) and each deploy changes the cache key
 * (infra/site.ts). An hour was too short to help: crawlers reach most of the ~15k pages about
 * once, so the copy expired before anyone asked again. The week is the backstop for a write
 * that clears nothing. Editors are signed in, so they never see the cached copy.
 */
export const DEFAULT_PUBLIC_CACHE_CONTROL =
  'public, max-age=0, s-maxage=604800, stale-while-revalidate=86400';
export const SIGNED_IN_CACHE_CONTROL = 'private, no-cache';

const SESSION_COOKIE = /(?:^|;\s*)rasika_session=/;

export function hasSessionCookie(request: Request): boolean {
  return SESSION_COOKIE.test(request.headers.get('Cookie') ?? '');
}

/** Sets a default Cache-Control on `headers`, in place, when the route left it to us. */
export function applyDefaultCacheControl(request: Request, status: number, headers: Headers) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  if (headers.has('Cache-Control')) return;
  if (status !== 200 || headers.has('Set-Cookie')) return;

  headers.set(
    'Cache-Control',
    hasSessionCookie(request) ? SIGNED_IN_CACHE_CONTROL : DEFAULT_PUBLIC_CACHE_CONTROL
  );
}

/**
 * Cache-Control for a page whose content is relative to today: /events, the city concert pages.
 *
 * The week above is wrong for these. Writes clear the cache, but on a day nobody writes, the
 * cached "Today" would still show yesterday, and the upcoming list would still hold last
 * night's concert. So the CDN copy lasts until midnight where the concerts are, India by
 * default, and never less than a minute. Signed-in readers get the same private copy as
 * everywhere else.
 */
export function cacheUntilMidnight(
  request: Request,
  timeZone: string,
  now: Date = new Date()
): string {
  if (hasSessionCookie(request)) return SIGNED_IN_CACHE_CONTROL;
  const tomorrow = addDaysToDate(todayInTimeZone(timeZone, now), 1);
  const seconds = Math.floor(
    (Date.parse(startOfDayInstant(tomorrow, timeZone)) - now.getTime()) / 1000
  );
  return `public, max-age=0, s-maxage=${Math.max(60, seconds)}, stale-while-revalidate=60`;
}
