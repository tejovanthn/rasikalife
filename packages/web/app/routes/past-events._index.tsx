import { data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const page = Number(url.searchParams.get('page') || '1');

  try {
    const result = await client.event.listPast.query({
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      events: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
      currentPage: page,
    });
  } catch (error) {
    console.error('Failed to load past events:', error);
    throw new Response('Failed to load past events', { status: 500 });
  }
};

export const meta: MetaFunction = () => [
  { title: 'Past Events - Indian Classical Arts - Rasika.life' },
  {
    name: 'description',
    content: 'Browse past Indian classical music and dance events and concerts.',
  },
  { name: 'robots', content: 'noindex' },
];

interface EventItem {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  organiserName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
  posterUrl?: string;
}

export default function PastEvents() {
  const { events, nextToken, hasMore, currentPage } = useLoaderData<{
    events: EventItem[];
    nextToken: string | null;
    hasMore: boolean;
    currentPage: number;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Past Events</h1>
        <p className="text-xl text-muted-foreground">
          Browse past Indian classical arts events and log your attendance
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState message="No past events found." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
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
