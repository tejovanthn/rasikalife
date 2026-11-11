import { useLoaderData } from 'react-router';
import { EventListing } from '~/components/events/event-listing';
import { BreadcrumbStructuredData, ItemListStructuredData } from '~/components/structured-data';
import type { CityListingPageData } from '~/lib/city-listing-meta';
import { DATE_PRESETS, listingHref } from '~/lib/event-filters';
import { eventListItems } from '~/lib/structured-data';
import { generateEventUrl } from '~/lib/url-slug';

const SITE = 'https://rasika.life';

/**
 * The body of `/events/<city>` and `/events/<city>/<preset>`, server-rendered from the same
 * listing as /events. Shared by `events.$eventid.tsx` (which serves a city when the segment is
 * not an event id) and `events.$city.$preset.tsx`.
 */
export function CityListingPage() {
  const d = useLoaderData() as unknown as CityListingPageData;
  const city = d.cityName ?? '';
  const preset = DATE_PRESETS.find(p => p.value === d.datePage);
  const base = listingHref(d.scope, {});

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <EventListing
        data={d}
        intro={
          // No subtitle on a phone: the heading and the filters must leave the first concert on
          // the first screen.
          <header className="mb-6">
            <h1 className="page-title">
              Concerts in {city}
              {preset ? ` ${preset.label.toLowerCase()}` : ''}
            </h1>
            <p className="hidden md:block text-muted-foreground">
              Carnatic concerts and classical arts events, with the venue and artists for each
            </p>
          </header>
        }
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: SITE },
          { name: 'Concerts', item: `${SITE}/events` },
          { name: `Concerts in ${city}`, item: `${SITE}${base}` },
          ...(preset
            ? [
                {
                  name: preset.label,
                  item: `${SITE}${listingHref(d.scope, { when: preset.value })}`,
                },
              ]
            : []),
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
