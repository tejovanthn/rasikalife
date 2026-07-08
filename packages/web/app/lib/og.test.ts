import { describe, expect, it } from 'vitest';
import { artistOgImageUrl, compositionOgImageUrl, ragaOgImageUrl } from './og';

describe('og image URL builders', () => {
  it('builds an artist OG image URL', () => {
    expect(artistOgImageUrl('artist-1')).toBe('https://rasika.life/og/artist/artist-1');
  });

  it('builds a raga OG image URL', () => {
    expect(ragaOgImageUrl('raga-1')).toBe('https://rasika.life/og/raga/raga-1');
  });

  it('builds a composition OG image URL', () => {
    expect(compositionOgImageUrl('comp-1')).toBe('https://rasika.life/og/composition/comp-1');
  });
});
