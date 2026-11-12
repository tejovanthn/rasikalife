import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './safe-http-url';

describe('safeHttpUrl', () => {
  it('passes http and https', () => {
    expect(safeHttpUrl('https://a.org/x')).toBe('https://a.org/x');
    expect(safeHttpUrl('http://a.org')).toBe('http://a.org');
  });
  it('drops script, data, relative and empty values', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl(' JAVASCRIPT:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('data:text/html,x')).toBeUndefined();
    expect(safeHttpUrl('/path')).toBeUndefined();
    expect(safeHttpUrl('')).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});
