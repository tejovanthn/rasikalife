import { describe, expect, it } from 'vitest';
import {
  GENERIC_OG_IMAGE_URL,
  artistOgImageUrl,
  compositionOgImageUrl,
  eventOgImage,
  eventOgImageUrl,
  ragaOgImageUrl,
} from './og';

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

describe('eventOgImage fallback order', () => {
  const event = { id: 'e1', posterOgUrl: 'og.jpg', posterUrl: 'poster.jpg' };

  it('prefers the OG crop, then the poster, then the festival poster', () => {
    expect(eventOgImage(event, 'fest.jpg')).toBe('og.jpg');
    expect(eventOgImage({ ...event, posterOgUrl: undefined }, 'fest.jpg')).toBe('poster.jpg');
    expect(eventOgImage({ id: 'e1' }, 'fest.jpg')).toBe('fest.jpg');
  });

  it('uses the generated text card when there is no poster of any kind', () => {
    expect(eventOgImage({ id: 'e1' })).toBe(eventOgImageUrl('e1'));
    expect(eventOgImage({ id: 'e1', posterUrl: '  ', posterOgUrl: null }, '')).toBe(
      'https://rasika.life/og/event/e1'
    );
  });

  it('uses the generic image only when there is no event id to render', () => {
    expect(eventOgImage({})).toBe(GENERIC_OG_IMAGE_URL);
  });
});
