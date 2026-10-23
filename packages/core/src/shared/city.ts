/**
 * City slugs for the `/<city>/concerts` landing pages. Browser-safe.
 *
 * A city is whatever a venue's address stores, so the slug is read from the data rather than
 * from a fixed list. The old names people still search by ("bangalore") resolve to the stored
 * one, and the route redirects to it, so one city never has two indexable URLs.
 */

/** Old or English names → the slug of the name the venues store. */
export const CITY_SLUG_ALIASES: Readonly<Record<string, string>> = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  mysore: 'mysuru',
  trivandrum: 'thiruvananthapuram',
};

export function citySlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The slug a city's page lives at, whichever spelling it arrived in. */
export function canonicalCitySlug(nameOrSlug: string): string {
  const slug = citySlug(nameOrSlug);
  return CITY_SLUG_ALIASES[slug] ?? slug;
}

export interface CityEntry {
  slug: string;
  /** The spelling most records in the city store. */
  name: string;
  count: number;
}

/**
 * One entry per city from a list of stored city names, one name per record. "Bangalore" and
 * "Bengaluru" are one city, named by whichever spelling more records use. Busiest first.
 */
export function foldCities(names: Array<string | null | undefined>): CityEntry[] {
  const bySlug = new Map<string, Map<string, number>>();
  for (const raw of names) {
    const name = raw?.trim();
    if (!name) continue;
    const slug = canonicalCitySlug(name);
    const spellings = bySlug.get(slug) ?? new Map<string, number>();
    spellings.set(name, (spellings.get(name) ?? 0) + 1);
    bySlug.set(slug, spellings);
  }
  return [...bySlug]
    .map(([slug, spellings]) => {
      const ranked = [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return { slug, name: ranked[0][0], count: ranked.reduce((sum, [, n]) => sum + n, 0) };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
