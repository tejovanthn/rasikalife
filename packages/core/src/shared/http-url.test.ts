import { describe, expect, it } from 'vitest';
import { httpUrlSchema, isHttpUrl } from './http-url';

describe('httpUrlSchema', () => {
  it('accepts http and https', () => {
    expect(httpUrlSchema.safeParse('https://a.org/x').success).toBe(true);
    expect(httpUrlSchema.safeParse('http://a.org').success).toBe(true);
  });
  it('refuses script and data URLs', () => {
    expect(httpUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(httpUrlSchema.safeParse('data:text/html,hi').success).toBe(false);
    expect(isHttpUrl('JaVaScRiPt:alert(1)')).toBe(false);
  });
});
