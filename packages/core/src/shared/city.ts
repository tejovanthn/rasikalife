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
