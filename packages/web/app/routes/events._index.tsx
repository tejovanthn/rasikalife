import { Plus } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EventCard } from '~/components/EventCard';
import { useAuth } from '~/components/auth-context';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');

  try {
    const result = await client.event.listUpcoming.query({
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      events: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load events:', error);
    throw new Response('Failed to load events', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Upcoming Events - Indian Classical Arts - Rasika.life' },
    {
      name: 'description',
      content:
        'Discover upcoming Indian classical music and dance events, concerts, festivals, and performances.',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/events' },
  ];
};

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

export default function EventsIndex() {
  const { events, nextToken, hasMore } = useLoaderData<{
    events: EventItem[];
    nextToken: string | null;
    hasMore: boolean;
  }>();
  const { user } = useAuth();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="text-xl text-muted-foreground">
            Upcoming Indian classical arts events and performances
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

      {events.length === 0 ? (
        <EmptyState message="No upcoming events at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          <div className="mt-8">
            <EntityPagination
              currentPage={1}
              hasMore={hasMore}
              nextToken={nextToken}
              baseUrl="/events"
            />
          </div>
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Events', item: 'https://rasika.life/events' },
        ]}
      />
    </main>
  );
}
