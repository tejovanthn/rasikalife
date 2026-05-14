import { data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EventDayGroup } from '~/components/EventDayGroup';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { isGenericTitle } from '~/lib/generic-title';

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
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, events]) => ({ date, events }));
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const page = Number(url.searchParams.get('page') || '1');

  const result = await client.event.listPast
    .query({
      limit: 20,
      nextToken: nextToken || undefined,
    })
    .catch(error => {
      console.error('Failed to load past events:', error);
      throw new Response('Failed to load past events', { status: 500 });
    });

  const withGeneric = result.items.map(event => ({
    ...event,
    isGeneric: isGenericTitle(event.title, event.artists, event.artForm),
  }));

  return data({
    groups: groupByDate(withGeneric),
    nextToken: result.nextToken,
    hasMore: result.hasMore,
    currentPage: page,
  });
};

export const meta: MetaFunction = () => [
  { title: 'Past Events - Indian Classical Arts - Rasika.life' },
  {
    name: 'description',
    content: 'Browse past Indian classical music and dance events and concerts.',
  },
  { name: 'robots', content: 'noindex' },
];

export default function PastEvents() {
  const { groups, nextToken, hasMore, currentPage } = useLoaderData<{
    groups: DayGroup[];
    nextToken: string | null;
    hasMore: boolean;
    currentPage: number;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="page-title">Past Events</h1>
        <p className="text-xl text-muted-foreground">
          Browse past Indian classical arts events and log your attendance
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState message="No past events found." />
      ) : (
        <>
          <div className="space-y-8">
            {groups.map(group => (
              <EventDayGroup key={group.date} date={group.date} events={group.events} />
            ))}
          </div>

          <div className="mt-8">
            <EntityPagination
              currentPage={currentPage}
              hasMore={hasMore}
              nextToken={nextToken}
              baseUrl="/past-events"
            />
          </div>
        </>
      )}

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Past Events', item: 'https://rasika.life/past-events' },
        ]}
      />
    </main>
  );
}
