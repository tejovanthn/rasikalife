import { describe, expect, it } from 'vitest';
import { SOCIAL_PLATFORM_LABELS, SocialLinkSchema, SocialPlatform } from './social-link';

describe('SOCIAL_PLATFORM_LABELS', () => {
  it('has a human-readable label for every SocialPlatform value', () => {
    for (const platform of SocialPlatform.options) {
      expect(SOCIAL_PLATFORM_LABELS[platform]).toEqual(expect.any(String));
      expect(SOCIAL_PLATFORM_LABELS[platform].length).toBeGreaterThan(0);
    }
  });
});

describe('SocialLinkSchema', () => {
  it('accepts a valid platform and URL', () => {
    const result = SocialLinkSchema.parse({ platform: 'youtube', url: 'https://youtube.com/x' });

    expect(result).toEqual({ platform: 'youtube', url: 'https://youtube.com/x' });
  });

  it('rejects an unknown platform', () => {
    expect(() =>
      SocialLinkSchema.parse({ platform: 'myspace', url: 'https://myspace.com/x' })
    ).toThrow();
  });

  it('rejects a non-URL string', () => {
    expect(() => SocialLinkSchema.parse({ platform: 'youtube', url: 'not-a-url' })).toThrow();
  });
});
