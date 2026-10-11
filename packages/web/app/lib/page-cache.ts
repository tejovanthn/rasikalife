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
 * An hour is how stale a signed-out reader may see an edit. Editors are signed in, so they
 * never see the cached copy.
 */
export const DEFAULT_PUBLIC_CACHE_CONTROL =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
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
