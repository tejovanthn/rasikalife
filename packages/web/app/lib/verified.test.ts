import { describe, expect, it } from 'vitest';
import { isVerified, verifiedTooltip } from './verified';

describe('verified badge', () => {
  it('uses the Copy tooltip', () => {
    expect(verifiedTooltip('Bangalore Gayana Samaja')).toBe(
      'Managed by Bangalore Gayana Samaja on rasika.life'
    );
  });

  it('shows only for a stored verifiedAt', () => {
    expect(isVerified({ verifiedAt: '2026-11-01T00:00:00.000Z' })).toBe(true);
    expect(isVerified({})).toBe(false);
    expect(isVerified({ verifiedAt: '' })).toBe(false);
    expect(isVerified({ verifiedAt: null })).toBe(false);
  });
});
