import { data, redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
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
