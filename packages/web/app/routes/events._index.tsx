import { Plus } from 'lucide-react';
import { Link, useLoaderData } from 'react-router';
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useAuth } from '~/components/auth-context';
import { EventListing } from '~/components/events/event-listing';
import { BreadcrumbStructuredData, ItemListStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';
import { DATE_PRESETS, listingHref } from '~/lib/event-filters';
import { type EventsPageData, eventsLoader } from '~/lib/events-page.server';
import { concertsMeta, eventsIndexMeta } from '~/lib/listing-description';
import { SIGNED_IN_CACHE_CONTROL } from '~/lib/page-cache';
import { eventListItems } from '~/lib/structured-data';
import { generateEventUrl } from '~/lib/url-slug';

export const loader = (args: LoaderFunctionArgs) => eventsLoader(args);

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? SIGNED_IN_CACHE_CONTROL,
});

export const meta: MetaFunction<typeof loader> = ({ data: raw }) => {
  const d = raw as unknown as EventsPageData | undefined;
  const preset = DATE_PRESETS.find(p => p.value === d?.state.when);
  const { title, description } = preset
    ? concertsMeta({ range: preset.label, count: d?.count ?? 0, next: d?.first })
    : eventsIndexMeta({ count: d?.count ?? 0, cities: d?.topCities ?? [] });
  // A date page is its own page; any other filter is a view of /events.
  const url = `https://rasika.life${preset ? listingHref({ kind: 'all' }, { when: preset.value }) : '/events'}`;
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { property: 'og:image', content: 'https://rasika.life/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: 'https://rasika.life/og-image.png' },
    { tagName: 'link', rel: 'canonical', href: url },
  ];
};

export default function EventsIndex() {
  const listing = useLoaderData<typeof loader>() as unknown as EventsPageData;
  const preset = DATE_PRESETS.find(p => p.value === listing.state.when);
  const { user } = useAuth();

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <EventListing
        data={listing}
        intro={
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="page-title">
                {preset ? `Concerts ${preset.label.toLowerCase()}` : 'Events'}
              </h1>
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
