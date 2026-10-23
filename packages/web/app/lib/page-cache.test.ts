import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_CACHE_CONTROL,
  SIGNED_IN_CACHE_CONTROL,
  applyDefaultCacheControl,
  cacheUntilMidnight,
} from './page-cache';

function get(cookie?: string, method = 'GET') {
  return new Request('https://rasika.life/ragas/kalyani', {
    method,
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function cacheControl(request: Request, status = 200, init: HeadersInit = {}) {
  const headers = new Headers(init);
  applyDefaultCacheControl(request, status, headers);
  return headers.get('Cache-Control');
}

describe('applyDefaultCacheControl', () => {
  it('lets CloudFront cache a signed-out page', () => {
    expect(cacheControl(get())).toBe(DEFAULT_PUBLIC_CACHE_CONTROL);
  });

  it('still caches a page for a reader with a script or theme choice', () => {
    // Those cookies are in the cache key, so each choice gets its own cached copy.
    expect(cacheControl(get('script_preference=abc; theme=def'))).toBe(
      DEFAULT_PUBLIC_CACHE_CONTROL
    );
  });

  it('keeps a signed-in page private, wherever the session cookie sits', () => {
    expect(cacheControl(get('rasika_session=x'))).toBe(SIGNED_IN_CACHE_CONTROL);
    expect(cacheControl(get('theme=a; rasika_session=x'))).toBe(SIGNED_IN_CACHE_CONTROL);
  });

  it('does not mistake a cookie that only ends in the session name', () => {
    expect(cacheControl(get('old_rasika_session=x'))).toBe(DEFAULT_PUBLIC_CACHE_CONTROL);
  });

  it("keeps the route's own Cache-Control", () => {
    expect(cacheControl(get(), 200, { 'Cache-Control': 'no-store' })).toBe('no-store');
  });

  it('never caches a response that sets a cookie', () => {
    expect(cacheControl(get(), 200, { 'Set-Cookie': 'theme=dark' })).toBeNull();
  });

  it('leaves errors, redirects and non-GET requests alone', () => {
    expect(cacheControl(get(), 404)).toBeNull();
    expect(cacheControl(get(), 302)).toBeNull();
    expect(cacheControl(get(undefined, 'POST'))).toBeNull();
  });
});

describe('cacheUntilMidnight', () => {
  const anon = new Request('https://rasika.life/events');

  it('lasts until midnight in the given zone', () => {
    // 22:00 IST on 23 Oct is 16:30Z; midnight IST is 18:30Z, two hours on.
    expect(cacheUntilMidnight(anon, 'Asia/Kolkata', new Date('2026-10-23T16:30:00Z'))).toBe(
      'public, max-age=0, s-maxage=7200, stale-while-revalidate=60'
    );
  });

  it('never drops below a minute', () => {
    expect(cacheUntilMidnight(anon, 'Asia/Kolkata', new Date('2026-10-23T18:29:59Z'))).toContain(
      's-maxage=60,'
    );
  });

  it('keeps a signed-in reader private', () => {
    const signedIn = new Request('https://rasika.life/events', {
      headers: { Cookie: 'rasika_session=abc' },
    });
    expect(cacheUntilMidnight(signedIn, 'Asia/Kolkata')).toBe(SIGNED_IN_CACHE_CONTROL);
  });
});
