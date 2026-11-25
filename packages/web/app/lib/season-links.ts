import { canonicalCitySlug } from '@rasika/core/shared/city';
import { listingHref } from '~/lib/event-filters';
import { FEATURED_CITIES } from '~/lib/featured-cities';

/**
 * Links from artist, venue, organiser and raga pages to the two city concert pages people
 * search for. Static: the cities are fixed and nothing is read from the database.
 *
 * The Chennai December season runs from mid-December to mid-January. The Chennai link says so
 * from 1 October to 15 January (India time), because that is when people look for it, and the
 * year is computed: the season is named for the year it starts, so 1 to 15 January still
 * belongs to the season that began the month before.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The season year to name, or null outside the window. `now` is injected for tests. */
export function chennaiSeasonYear(now: Date): number | null {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const month = ist.getUTCMonth(); // 0 = January
  const day = ist.getUTCDate();
  const year = ist.getUTCFullYear();
  if (month === 0) return day <= 15 ? year - 1 : null;
  if (month >= 9) return year; // October to December
  return null;
}

export interface SeasonLink {
  slug: string;
  href: string;
  text: string;
}

/**
 * The links for a page, the page's own city first. `city` is any spelling of a city name
 * ("Bangalore" folds to Bengaluru); an unknown or missing city keeps the default order.
 */
export function seasonLinks(now: Date, city?: string | null): SeasonLink[] {
  const seasonYear = chennaiSeasonYear(now);
  const links = FEATURED_CITIES.map(({ slug, name }): SeasonLink => {
    const inSeason = slug === 'chennai' && seasonYear !== null;
    return {
      slug,
      href: listingHref({ kind: 'city', slug }, {}),
      text: inSeason
        ? `Chennai December Season ${seasonYear} concerts`
        : `Carnatic concerts in ${name}`,
    };
  });
  const own = city ? canonicalCitySlug(city) : '';
  return [...links].sort((a, b) => Number(b.slug === own) - Number(a.slug === own));
}
