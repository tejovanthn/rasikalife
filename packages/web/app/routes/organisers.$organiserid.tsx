import { Pencil, Trash2 } from 'lucide-react';
import { data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateOrganiserUrl, parseSlug } from '~/lib/url-slug';

interface OrganiserDetail {
  id: string;
  name: string;
}

interface EventItem {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const { organiserid } = params;
  if (!organiserid) {
    throw new Response('Organiser ID is required', { status: 400 });
  }

  const parsed = parseSlug(organiserid);
  const id = parsed ? parsed.id : organiserid;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const [organiser, eventsResult] = await Promise.all([
      serverClient.organiser.get.query({ id }),
      serverClient.event.byOrganiser.query({ organiserId: id, limit: 50 }),
    ]);

    if (!organiser) {
      throw new Response('Organiser not found', { status: 404 });
    }

    return data({
      organiser,
      events: eventsResult.items,
      user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    console.error('Failed to load organiser:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.ORGANISER_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Organiser not found', { status: 404 });
    }
    throw new Response('Failed to load organiser', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const organiser = (loaderData as { organiser: OrganiserDetail } | undefined)?.organiser;
  if (!organiser) {
    return [{ title: 'Organiser Not Found - Rasika.life' }];
  }

  return [
    { title: `${organiser.name} - Organiser - Rasika.life` },
    {
      name: 'description',
      content: `Events organised by ${organiser.name}. Indian classical arts performances and concerts.`,
    },
  ];
};

export default function OrganiserDetailPage() {
  const { organiser, events, user, isModerator } = useLoaderData<{
    organiser: OrganiserDetail;
    events: EventItem[];
    user: { id: string } | null;
    isModerator: boolean;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: organiser.name, path: '#' },
        ]}
      />

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{organiser.name}</h1>
          <div className="flex items-center gap-2">
            {user && (
              <a
                href={`${generateOrganiserUrl(organiser.name, organiser.id)}/edit`}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </a>
            )}
            {isModerator && (
              <a
                href={`/moderator/request-deletion?entityType=organiser&entityId=${organiser.id}`}
                className="inline-flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </a>
            )}
          </div>
        </div>
        <p className="text-muted-foreground mt-1">Event Organiser</p>
      </div>

      <section className="mt-10">
        <h2 className="section-heading mb-6">Events</h2>

        {events.length === 0 ? (
          <EmptyState message="No events by this organiser yet." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events
              .sort(
                (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
              )
              .map(event => (
                <EventCard key={event.id} event={event} />
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
