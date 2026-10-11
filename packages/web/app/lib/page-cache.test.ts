import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_CACHE_CONTROL,
  SIGNED_IN_CACHE_CONTROL,
  applyDefaultCacheControl,
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
