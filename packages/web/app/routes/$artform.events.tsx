import { ART_FORMS, ART_FORM_LABELS } from '@rasika/core/domain/event/client';
import { data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';

export const loader: LoaderFunction = async ({ params, request }) => {
  const artForm = params.artform;
  if (!artForm || !ART_FORMS.has(artForm)) {
    throw new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');

  try {
    const result = await client.event.byArtForm.query({
      artForm,
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      artForm,
      label: ART_FORM_LABELS[artForm] || artForm,
      events: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error(`Failed to load ${artForm} events:`, error);
    throw new Response('Failed to load events', { status: 500 });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const label = loaderData?.label ?? 'Art Form';
  return [
    { title: `${label} Events - Rasika.life` },
    {
      name: 'description',
      content: `Discover upcoming ${label} events, concerts, festivals, and performances.`,
    },
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

export default function ArtFormEvents() {
  const { artForm, label, events, nextToken, hasMore } = useLoaderData<{
    artForm: string;
    label: string;
    events: EventItem[];
    nextToken: string | null;
    hasMore: boolean;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">{label} Events</h1>
        <p className="text-xl text-muted-foreground">
          Upcoming {label.toLowerCase()} events and performances
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState message={`No upcoming ${label.toLowerCase()} events at the moment.`} />
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
              baseUrl={`/${artForm}/events`}
            />
          </div>
        </>
      )}
    </main>
  );
}
