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
    const result = leadWithWidest(
      [photo('portrait', 800, 1200), photo('square', 1000, 1000), photo('landscape', 1600, 900)],
      {}
    );

    expect(result.map(p => p.id)).toEqual(['landscape', 'portrait', 'square']);
  });

  // Reordering must not otherwise shuffle the set: the order it is given already encodes the
  // moderator's featured choices.
  it('keeps the remaining order intact', () => {
    const result = leadWithWidest(
      [photo('a', 800, 1200), photo('b', 800, 1200), photo('c', 1600, 900), photo('d', 800, 1200)],
      {}
    );

    expect(result.map(p => p.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('leaves the list alone when the lead is already the widest', () => {
    const input = [photo('wide', 1600, 900), photo('tall', 800, 1200)];

    expect(leadWithWidest(input, {})).toEqual(input);
  });

  /**
   * The failure that made the first version useless. `width` and `height` are optional on the
   * entity and only written by the multi-select upload path, so every photograph predating it
   * measures as square — and with no measured ratios to fall back on, nothing ever moved.
   */
  it('does nothing when no photo has dimensions and none were measured', () => {
    const input = [photo('a'), photo('b'), photo('c')];

    expect(leadWithWidest(input, {})).toEqual(input);
  });

  it('uses a measured ratio for a photo the database has no dimensions for', () => {
    const result = leadWithWidest([photo('unknown-tall'), photo('unknown-wide')], {
      'unknown-tall': 0.66,
      'unknown-wide': 1.78,
    });

    expect(result[0].id).toBe('unknown-wide');
  });

  // Measurement is the more reliable source: a stored dimension can be wrong or stale, and the
  // browser is reading the file that is actually on screen.
  it('prefers a measured ratio over a stored one', () => {
    const result = leadWithWidest([photo('stored-wide', 1600, 900), photo('measured-wider')], {
      'measured-wider': 3,
    });

    expect(result[0].id).toBe('measured-wider');
  });

  // A swap after load is visible, so it has to buy something. Two photos that crop about the
  // same should not trade places.
  it('does not swap for a negligible difference', () => {
    const input = [photo('lead', 1000, 1000), photo('barely-wider', 1050, 1000)];

    expect(leadWithWidest(input, {})).toEqual(input);
  });

  it('swaps once the difference is worth seeing', () => {
    const result = leadWithWidest(
      [photo('lead', 1000, 1000), photo('clearly-wider', 1600, 900)],
      {}
    );

    expect(result[0].id).toBe('clearly-wider');
  });

  it('handles a half-populated dimension pair without dividing by zero', () => {
    const result = leadWithWidest(
      [photo('tall', 800, 1200), photo('partial', 1600, undefined)],
      {}
    );

    expect(result).toHaveLength(2);
    expect(result.every(p => Number.isFinite(p.width ?? 0))).toBe(true);
  });

  it('returns short lists untouched', () => {
    expect(leadWithWidest([], {})).toEqual([]);
    const single = [photo('only', 800, 1200)];
    expect(leadWithWidest(single, {})).toEqual(single);
  });
});
