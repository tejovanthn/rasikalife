import { canonicalCitySlug } from '@rasika/core/shared/city';
import { parseSlug } from '~/lib/url-slug';

/**
 * `/events/<x>` is two kinds of page: one event, or one city's listing. React Router cannot
 * tell two dynamic routes at the same path apart, so `routes/events.$eventid.tsx` serves both
 * and asks this first.
 *
 * An event URL always ends in a 27-character KSUID (`parseSlug`), so that test comes first and
 * a city slug can never shadow an event. Static segments (`today`, `new`, `tags`, ...) have
 * their own route files and the router ranks them above any `$param`, so they never reach here.
 * Anything that is neither an event id nor a known city ends as a 404 from the listing loader.
 */
export type EventsSegment = 'event' | 'city';

export function resolveEventsSegment(param: string): EventsSegment {
  return parseSlug(param) ? 'event' : 'city';
}

/**
 * Where an old `/<city>/concerts` URL now lives: `/events/<city>`, the query string kept, and
 * an old city name (`bangalore`) folded to the stored one in the same hop. Kept for good: the
 * old URLs are indexed, shared and printed.
 */
export function legacyConcertsRedirect(city: string, search: string): string {
  return `/events/${canonicalCitySlug(city)}${search}`;
}
