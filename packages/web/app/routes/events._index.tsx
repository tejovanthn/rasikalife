import { Plus } from 'lucide-react';
import { Link, data, redirect, useLoaderData } from 'react-router';
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useAuth } from '~/components/auth-context';
import { EventListing } from '~/components/events/event-listing';
import { BreadcrumbStructuredData, ItemListStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';
import {
  type EventListingData,
  ListingRedirect,
  loadEventListing,
} from '~/lib/event-listing.server';
import { eventsIndexMeta } from '~/lib/listing-description';
import { SIGNED_IN_CACHE_CONTROL } from '~/lib/page-cache';
import { eventListItems } from '~/lib/structured-data';
import { generateEventUrl } from '~/lib/url-slug';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const result = await loadEventListing(request).catch(error => {
    if (error instanceof Response) throw error;
    console.error('Failed to load events:', error);
    throw new Response('Failed to load events', { status: 500 });
  });
  if (result instanceof ListingRedirect) throw redirect(result.location, 301);
  return data(result.data, { headers: result.headers });
};

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? SIGNED_IN_CACHE_CONTROL,
});

export const meta: MetaFunction<typeof loader> = ({ data: d }) => {
  const { title, description } = eventsIndexMeta({
    count: d?.count ?? 0,
    cities: d?.topCities ?? [],
  });
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://rasika.life/events' },
    { property: 'og:image', content: 'https://rasika.life/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: 'https://rasika.life/og-image.png' },
    // Every filtered view is a variant of this page; the city pages are the ones to rank.
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/events' },
  ];
};

export default function EventsIndex() {
  const listing = useLoaderData<typeof loader>() as unknown as EventListingData;
  const { user } = useAuth();

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <EventListing
        data={listing}
        intro={
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="page-title">Events</h1>
              <p className="text-xl text-muted-foreground">
                Upcoming Carnatic concerts and classical arts events
              </p>
            </div>
            {user && (
              <Link to="/events/new" className="shrink-0">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event
                </Button>
              </Link>
            )}
          </header>
        }
      />

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Events', item: 'https://rasika.life/events' },
        ]}
      />
      {/* The concerts on show, flattened back out of their day groups. `ItemList` is the shape
          Google documents for a page that is a set of events rather than one event. */}
      <ItemListStructuredData
        items={eventListItems(
          listing.groups.flatMap(group => group.events),
          generateEventUrl
        )}
      />
    </main>
  );
}
