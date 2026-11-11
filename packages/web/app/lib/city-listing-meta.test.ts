import { describe, expect, it } from 'vitest';
import { type CityListingPageData, cityListingMeta } from './city-listing-meta';

function page(over: Partial<CityListingPageData> = {}): CityListingPageData {
  return {
    kind: 'city',
    scope: { kind: 'city', slug: 'chennai' },
    cityName: 'Chennai',
    state: {},
    range: null,
    groups: [{ date: '2026-12-05', events: [] }],
    count: 12,
    hasAny: true,
    datePage: null,
    first: { name: 'Sanjay Subrahmanyan', day: 'Sat, 5 Dec', venue: 'Music Academy' },
    ...over,
  } as unknown as CityListingPageData;
}

const find = (tags: ReturnType<typeof cityListingMeta>, key: string, value: string) =>
  tags.find(t => (t as Record<string, unknown>)[key] === value) as
    | Record<string, string>
    | undefined;

describe('cityListingMeta', () => {
  it('titles the city page, with the December season for Chennai, and indexes it', () => {
    const tags = cityListingMeta(page());
    expect(tags[0]).toEqual({
      title: 'Carnatic Concerts in Chennai: December Season 2026 Schedule',
    });
    expect(find(tags, 'rel', 'canonical')?.href).toBe('https://rasika.life/events/chennai');
    expect(find(tags, 'name', 'robots')).toBeUndefined();
  });

  it('keeps ?when= on the city page a view of it: same canonical, indexable', () => {
    const tags = cityListingMeta(page({ state: { when: 'weekend' } }));
    expect(find(tags, 'rel', 'canonical')?.href).toBe('https://rasika.life/events/chennai');
    expect(find(tags, 'name', 'robots')).toBeUndefined();
  });

  it('noindexes a city with nothing upcoming', () => {
    const tags = cityListingMeta(page({ hasAny: false, count: 0, groups: [] }));
    expect(find(tags, 'name', 'robots')?.content).toBe('noindex, follow');
  });

  it('gives a city date page its own title, a self canonical and noindex, follow', () => {
    const tags = cityListingMeta(
      page({ datePage: 'weekend', state: { when: 'weekend' }, count: 3 })
    );
    expect(tags[0]).toEqual({ title: 'Carnatic Concerts in Chennai This Weekend | Rasika.life' });
    expect(find(tags, 'rel', 'canonical')?.href).toBe(
      'https://rasika.life/events/chennai/this-weekend'
    );
    expect(find(tags, 'property', 'og:url')?.content).toBe(
      'https://rasika.life/events/chennai/this-weekend'
    );
    expect(find(tags, 'name', 'robots')?.content).toBe('noindex, follow');
  });

  it('falls back to a bare title with no data', () => {
    expect(cityListingMeta(undefined)).toEqual([{ title: 'Concerts | Rasika.life' }]);
  });
});
