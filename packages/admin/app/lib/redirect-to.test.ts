import { describe, expect, it } from 'vitest';
import { safeRedirectTo } from './redirect-to';

describe('safeRedirectTo', () => {
  it('allows an ordinary path', () => {
    expect(safeRedirectTo('/teaching')).toBe('/teaching');
    expect(safeRedirectTo('/home?learner=abc')).toBe('/home?learner=abc');
    expect(safeRedirectTo('/')).toBe('/');
  });

  /**
   * The bug this exists for. `startsWith('/')` passes `//evil.com`, and a browser resolves that
   * against the current origin as `https://evil.com` — so a real sign-in on this domain was one
   * hop from a phishing page, with a genuine Google consent screen on the way.
   */
  it('rejects a protocol-relative URL', () => {
    expect(safeRedirectTo('//evil.com/phish')).toBe('/');
    expect(safeRedirectTo('//evil.com')).toBe('/');
  });

  // Some browsers normalise a backslash to a slash in the authority position.
  it('rejects the backslash variant', () => {
    expect(safeRedirectTo('/\\evil.com')).toBe('/');
  });

  it('rejects an absolute URL', () => {
    expect(safeRedirectTo('https://evil.com')).toBe('/');
    expect(safeRedirectTo('javascript:alert(1)')).toBe('/');
  });

  it('falls back for anything missing', () => {
    expect(safeRedirectTo(null)).toBe('/');
    expect(safeRedirectTo(undefined)).toBe('/');
    expect(safeRedirectTo('')).toBe('/');
  });

  it('takes a caller-supplied fallback', () => {
    expect(safeRedirectTo('//evil.com', '/home')).toBe('/home');
  });
});
