import { Plus } from 'lucide-react';
import { Link, data, useLoaderData, useNavigate } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EventDayGroup } from '~/components/EventDayGroup';
import { useAuth } from '~/components/auth-context';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData, ItemListStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { isGenericTitle } from '~/lib/generic-title';
import { eventsIndexMeta } from '~/lib/listing-description';
import { eventListItems } from '~/lib/structured-data';
import { generateEventUrl } from '~/lib/url-slug';

interface EventItem {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  venueCity?: string;
  organiserName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
  posterUrl?: string;
  artForm?: string;
}

interface DayGroup {
  date: string;
  events: Array<EventItem & { isGeneric: boolean }>;
}

function groupByDate<T extends { startDateTime: string }>(events: T[]) {
  const map = new Map<string, T[]>();
  for (const event of events) {
    const key = event.startDateTime.slice(0, 10);
    const bucket = map.get(key);
    if (bucket) bucket.push(event);
    else map.set(key, [event]);
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({ date, events }));
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const city = url.searchParams.get('city') ?? '';

  const result = await client.event.listUpcoming.query({ limit: 100 }).catch(error => {
    console.error('Failed to load events:', error);
    throw new Response('Failed to load events', { status: 500 });
  });

  const withGeneric = result.items.map(event => ({
    ...event,
    isGeneric: isGenericTitle(event.title, event.artists, event.artForm),
  }));

  const filtered = city ? withGeneric.filter(e => e.venueCity === city) : withGeneric;

  const uniqueCities = [...new Set(result.items.map(e => e.venueCity).filter(Boolean))].sort();

  // Busiest cities first, for the meta description.
  const cityCounts = new Map<string, number>();
  for (const e of result.items) {
    if (e.venueCity) cityCounts.set(e.venueCity, (cityCounts.get(e.venueCity) ?? 0) + 1);
  }
  const topCities = [...cityCounts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return data({
    groups: groupByDate(filtered),
    uniqueCities,
    city,
    topCities,
    count: filtered.length,
  });
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const d = loaderData as { count?: number; topCities?: string[]; city?: string } | undefined;
  const { title, description } = eventsIndexMeta({
    count: d?.count ?? 0,
    cities: d?.topCities ?? [],
    city: d?.city || undefined,
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
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/events' },
  ];
};

export default function EventsIndex() {
  const { groups, uniqueCities, city } = useLoaderData<{
    groups: DayGroup[];
    uniqueCities: string[];
    city: string;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleCityChange(value: string) {
    navigate(value === '__all__' ? '/events' : `/events?city=${encodeURIComponent(value)}`);
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="text-xl text-muted-foreground">
            Upcoming Carnatic concerts and classical arts events
          </p>
        </div>
        {user && (
          <Link to="/events/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </Link>
        )}
      </header>

      {uniqueCities.length > 1 && (
        <div className="mb-6">
          <Select value={city || '__all__'} onValueChange={handleCityChange}>
            {/* Standalone toolbar filter, not part of a form — see DESIGN.md density rule. */}
            <SelectTrigger className="w-48" aria-label="Filter by city">
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All cities</SelectItem>
              {uniqueCities.map(c => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState message="No upcoming events at the moment." />
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <EventDayGroup key={group.date} date={group.date} events={group.events} />
          ))}
        </div>
      )}

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
          groups.flatMap(group => group.events),
          generateEventUrl
        )}
      />
    </main>
  );
}
