import { data, redirect, useLoaderData } from 'react-router';
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { EventListing } from '~/components/events/event-listing';
import { BreadcrumbStructuredData, ItemListStructuredData } from '~/components/structured-data';
import { DATE_PRESETS, listingHref, presetFromSegment } from '~/lib/event-filters';
import {
  type EventListingData,
  ListingRedirect,
  firstConcert,
  loadEventListing,
} from '~/lib/event-listing.server';
import { cityConcertsMeta } from '~/lib/listing-description';
import { SIGNED_IN_CACHE_CONTROL } from '~/lib/page-cache';
import { eventListItems } from '~/lib/structured-data';
import { generateEventUrl } from '~/lib/url-slug';

/**
 * `/<city>/concerts`, and through `$city.concerts.$when.tsx`, `/today`, `/this-weekend` and
 * `/this-week` under it. The pages people search for ("carnatic concerts in bangalore this
 * weekend"), server-rendered from the same listing as /events. An old city name redirects to
 * the stored one; a city no venue is in is a 404.
 */

const SITE = 'https://rasika.life';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const city = params.city ?? '';
  if (params.when !== undefined && !presetFromSegment(params.when)) {
    throw new Response('Not Found', { status: 404 });
  }
  const result = await loadEventListing(request, { city, presetSegment: params.when }).catch(
    error => {
      if (error instanceof Response) throw error;
      console.error(`Failed to load concerts for ${city}:`, error);
      throw new Response('Failed to load events', { status: 500 });
    }
  );
  if (result instanceof ListingRedirect) throw redirect(result.location, 301);
  return data(
    { ...result.data, first: firstConcert(result.data), hasAny: result.data.months.length > 0 },
    { headers: result.headers }
  );
};

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? SIGNED_IN_CACHE_CONTROL,
});

type LoaderData = EventListingData & {
  first?: ReturnType<typeof firstConcert>;
  hasAny: boolean;
};

/** Only the date presets are pages of their own; a month, a day or "free" is a view of one. */
function canonicalPath(d: LoaderData) {
  const preset = DATE_PRESETS.some(p => p.value === d.state.when) ? d.state.when : null;
  return listingHref(d.scope, { when: preset });
}

export const meta: MetaFunction<typeof loader> = ({ data: raw }) => {
  const d = raw as unknown as LoaderData | undefined;
  if (!d?.cityName) return [{ title: 'Concerts | Rasika.life' }];
  const preset = DATE_PRESETS.find(p => p.value === d.state.when);
  const { title, description } = cityConcertsMeta({
    city: d.cityName,
    range: preset?.label,
    count: d.count,
    next: d.first,
  });
  const url = `${SITE}${canonicalPath(d)}`;
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { property: 'og:image', content: `${SITE}/og-image.png` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { tagName: 'link', rel: 'canonical', href: url },
    // A city with nothing coming up at all is a bare page; it rejoins the index with its
    // first listed concert. An empty "today" in a busy city still lists what is next.
    ...(d.hasAny ? [] : [{ name: 'robots', content: 'noindex, follow' }]),
  ];
};

export default function CityConcerts() {
  const d = useLoaderData<typeof loader>() as unknown as LoaderData;
  const city = d.cityName ?? '';
  const preset = DATE_PRESETS.find(p => p.value === d.state.when);
  const base = listingHref(d.scope, {});

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <EventListing
        data={d}
        intro={
          <header className="mb-6">
            <h1 className="page-title">
              Concerts in {city}
              {preset ? ` ${preset.label.toLowerCase()}` : ''}
            </h1>
            <p className="text-xl text-muted-foreground">
              Carnatic concerts and classical arts events, with the venue and artists for each
            </p>
          </header>
        }
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: SITE },
          { name: 'Events', item: `${SITE}/events` },
          { name: `Concerts in ${city}`, item: `${SITE}${base}` },
          ...(preset ? [{ name: preset.label, item: `${SITE}${canonicalPath(d)}` }] : []),
        ]}
      />
      <ItemListStructuredData
        items={eventListItems(
          d.groups.flatMap(group => group.events),
          generateEventUrl
        )}
      />
    </main>
  );
}
