import { describe, expect, it } from 'vitest';
import { leadWithWidest } from './ArtistGalleryHero';
import type { HeroPhoto } from './ArtistGalleryHero';

const photo = (id: string, width?: number, height?: number): HeroPhoto => ({
  id,
  url: `https://cdn.example.com/${id}.jpg`,
  width,
  height,
});

describe('leadWithWidest', () => {
  // The lead frame is landscape. A portrait photograph dropped into it loses most of its height,
  // which is how the hero ended up leading with a sliver of a dancer lying down.
  it('promotes the widest photograph to the lead', () => {
    const result = leadWithWidest([
      photo('portrait', 800, 1200),
      photo('square', 1000, 1000),
      photo('landscape', 1600, 900),
    ]);

    expect(result.map(p => p.id)).toEqual(['landscape', 'portrait', 'square']);
  });

  // Reordering must not otherwise shuffle the set: the order it is given already encodes the
  // moderator's featured choices.
  it('keeps the remaining order intact', () => {
    const result = leadWithWidest([
      photo('a', 800, 1200),
      photo('b', 800, 1200),
      photo('c', 1600, 900),
      photo('d', 800, 1200),
    ]);

    expect(result.map(p => p.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('leaves the list alone when the lead is already the widest', () => {
    const input = [photo('wide', 1600, 900), photo('tall', 800, 1200)];

    expect(leadWithWidest(input)).toEqual(input);
  });

  // Older rows predate stored dimensions. Treating them as square keeps them eligible without
  // letting an unknown shape displace a photo known to be landscape.
  it('treats a photo with no dimensions as square', () => {
    const result = leadWithWidest([photo('unknown'), photo('landscape', 1600, 900)]);
    expect(result[0].id).toBe('landscape');

    const noneWider = leadWithWidest([photo('unknown'), photo('tall', 800, 1200)]);
    expect(noneWider[0].id).toBe('unknown');
  });

  it('handles a half-populated dimension pair without dividing by zero', () => {
    const result = leadWithWidest([photo('partial', 1600, undefined), photo('tall', 800, 1200)]);

    expect(result[0].id).toBe('partial');
    expect(result).toHaveLength(2);
  });

  it('returns short lists untouched', () => {
    expect(leadWithWidest([])).toEqual([]);
    const single = [photo('only', 800, 1200)];
    expect(leadWithWidest(single)).toEqual(single);
  });
});
