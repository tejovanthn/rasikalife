import { data, redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { presetFromSegment } from '~/lib/event-filters';
import {
  type EventListingData,
  ListingRedirect,
  firstConcert,
  loadEventListing,
} from '~/lib/event-listing.server';

export type EventsPageData = EventListingData & { first?: ReturnType<typeof firstConcert> };

/**
 * The loader of `/events` and its date pages (`events.today.tsx` and siblings), which pass the
 * preset segment. Here rather than exported from the route module, because a route's non-loader
 * exports ship to the browser and this reaches the server-only listing code.
 */
export async function eventsLoader({ request }: LoaderFunctionArgs, presetSegment?: string) {
  const result = await loadEventListing(request, { presetSegment }).catch(error => {
    if (error instanceof Response) throw error;
    console.error('Failed to load events:', error);
    throw new Response('Failed to load events', { status: 500 });
  });
  if (result instanceof ListingRedirect) throw redirect(result.location, 301);
  return data({ ...result.data, first: firstConcert(result.data) }, { headers: result.headers });
}

/**
 * The loader of `/events/<city>` and `/events/<city>/<preset>`. The first is reached through
 * `events.$eventid.tsx`, which hands over when the segment is not an event id; the second is
 * `events.$city.$preset.tsx`. An unknown preset segment is a 404, like an unknown city.
 */
export async function cityListingLoader(
  { request }: LoaderFunctionArgs,
  city: string,
  presetSegment?: string
) {
  if (presetSegment !== undefined && !presetFromSegment(presetSegment)) {
    throw new Response('Not Found', { status: 404 });
  }
  const result = await loadEventListing(request, { city, presetSegment }).catch(error => {
    if (error instanceof Response) throw error;
    console.error(`Failed to load concerts for ${city}:`, error);
    throw new Response('Failed to load events', { status: 500 });
  });
  if (result instanceof ListingRedirect) throw redirect(result.location, 301);
  return data(
    {
      ...result.data,
      kind: 'city' as const,
      first: firstConcert(result.data),
      hasAny: result.data.calendar.lastMonth !== null,
      /** Set on `/events/<city>/<preset>` only, not for `?when=` on the city page. */
      datePage: presetSegment ? (presetFromSegment(presetSegment) ?? null) : null,
    },
    { headers: result.headers }
  );
}
