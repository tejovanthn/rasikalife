import { describe, expect, it } from 'vitest';
import { featuredCityLinks } from './featured-cities';

describe('featuredCityLinks', () => {
  it('links Chennai and Bengaluru to their concert pages', () => {
    expect(featuredCityLinks().map(c => c.href)).toEqual([
      '/chennai/concerts',
      '/bengaluru/concerts',
    ]);
  });

  it('carries the live count, and none for a city with no concert', () => {
    const [chennai, bengaluru] = featuredCityLinks([{ slug: 'bengaluru', count: 9 }]);
    expect(chennai.count).toBeUndefined();
    expect(bengaluru.count).toBe(9);
  });
});
