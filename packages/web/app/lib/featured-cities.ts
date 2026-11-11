import { listingHref } from '~/lib/event-filters';

/**
 * Cities people search "carnatic concerts in <city>" for (Chennai 260 a month, peaking at 720 in
 * December; Bengaluru). They are linked from /events and the home page even when no concert is
 * listed yet, so the pages are one click from the places a visitor starts. An empty city page is
 * `noindex` and out of the sitemap, so the link costs no crawl budget.
 */
export const FEATURED_CITIES = [
  { slug: 'chennai', name: 'Chennai' },
  { slug: 'bengaluru', name: 'Bengaluru' },
] as const;

export interface CityLink {
  slug: string;
  name: string;
  href: string;
  count?: number;
}

/** The featured cities with the live concert count where the listing has one. */
export function featuredCityLinks(cities: ReadonlyArray<{ slug: string; count: number }> = []) {
  return FEATURED_CITIES.map(
    (city): CityLink => ({
      ...city,
      href: listingHref({ kind: 'city', slug: city.slug }, {}),
      count: cities.find(c => c.slug === city.slug)?.count,
    })
  );
}

/**
 * The cities for the home page line: the featured ones first, always shown, then every other
 * city with an upcoming concert, busiest first. Counts and names come from the listings; a
 * listing with no city is not counted.
 */
export function homeCityLinks(
  listings: ReadonlyArray<{ city?: string | null; citySlug?: string | null }>
): CityLink[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const { city, citySlug } of listings) {
    if (!city || !citySlug) continue;
    const seen = counts.get(citySlug);
    if (seen) seen.count += 1;
    else counts.set(citySlug, { name: city, count: 1 });
  }
  const featured = featuredCityLinks([...counts].map(([slug, { count }]) => ({ slug, count })));
  const featuredSlugs = new Set<string>(featured.map(c => c.slug));
  const others = [...counts]
    .filter(([slug]) => !featuredSlugs.has(slug))
    .map(
      ([slug, { name, count }]): CityLink => ({
        slug,
        name,
        count,
        href: listingHref({ kind: 'city', slug }, {}),
      })
    )
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name));
  return [...featured, ...others];
}
