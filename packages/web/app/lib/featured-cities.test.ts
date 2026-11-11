import { describe, expect, it } from 'vitest';
import { featuredCityLinks, homeCityLinks } from './featured-cities';

describe('featuredCityLinks', () => {
  it('links Chennai and Bengaluru to their concert pages', () => {
    expect(featuredCityLinks().map(c => c.href)).toEqual(['/events/chennai', '/events/bengaluru']);
  });

  it('carries the live count, and none for a city with no concert', () => {
    const [chennai, bengaluru] = featuredCityLinks([{ slug: 'bengaluru', count: 9 }]);
    expect(chennai.count).toBeUndefined();
    expect(bengaluru.count).toBe(9);
  });
});

describe('homeCityLinks', () => {
  const at = (city?: string) => ({ city, citySlug: city?.toLowerCase() });

  it('shows the featured cities even with no concert', () => {
    expect(homeCityLinks([]).map(c => c.slug)).toEqual(['chennai', 'bengaluru']);
  });

  it('adds other cities after the featured ones, busiest first', () => {
    const links = homeCityLinks([
      at('Mysuru'),
      at('Pune'),
      at('Pune'),
      at('Bengaluru'),
      at('Chennai'),
      at('Chennai'),
      at(undefined),
    ]);
    expect(links.map(c => [c.name, c.count])).toEqual([
      ['Chennai', 2],
      ['Bengaluru', 1],
      ['Pune', 2],
      ['Mysuru', 1],
    ]);
    expect(links[2].href).toBe('/events/pune');
  });
});
