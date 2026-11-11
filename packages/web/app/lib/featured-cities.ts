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
