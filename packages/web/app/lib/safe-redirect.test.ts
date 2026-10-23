import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('keeps a path on this site', () => {
    expect(safeRedirectPath('/events/today?free=1')).toBe('/events/today?free=1');
  });

  it('refuses anything that could leave it', () => {
    expect(safeRedirectPath('//evil.example')).toBeNull();
    expect(safeRedirectPath('/\\evil.example')).toBeNull();
    expect(safeRedirectPath('https://evil.example')).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
  });
});
