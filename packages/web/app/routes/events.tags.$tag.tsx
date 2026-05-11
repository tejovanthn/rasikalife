import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';

export const loader: LoaderFunction = async ({ params }) => {
  const tag = params.tag;
  if (!tag) {
    throw new Response('Not Found', { status: 404 });
  }

  try {
    const result = await client.event.byTag.query({ tag });
    return data({ tag, events: result.items });
  } catch (error) {
    console.error(`Failed to load events for tag [${tag}]:`, error);
    throw new Response('Failed to load events', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data }) => {
  const loaderData = data as { tag: string } | undefined;
  const tag = loaderData?.tag ?? '';
  const canonicalUrl = `https://rasika.life/events/tags/${encodeURIComponent(tag)}`;
  return [
    { title: `Events tagged "${tag}" - Rasika.life` },
    {
      name: 'description',
      content: `Upcoming Indian classical arts events tagged with "${tag}".`,
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
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

export default function EventsByTag() {
  const { tag, events } = useLoaderData<{ tag: string; events: EventItem[] }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <nav className="mb-4">
        <Link to="/events" className="text-sm text-muted-foreground hover:text-primary">
          ← All events
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="page-title">Events tagged "{tag}"</h1>
        <p className="text-xl text-muted-foreground">
          Upcoming events{events.length > 0 ? ` (${events.length})` : ''}
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState message={`No upcoming events tagged "${tag}".`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Events', item: 'https://rasika.life/events' },
          { name: `"${tag}"`, item: `https://rasika.life/events/tags/${encodeURIComponent(tag)}` },
        ]}
      />
    </main>
  );
}
