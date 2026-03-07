import { data, redirect, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
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
  if (!parsed) {
    throw new Response('Organiser not found', { status: 404 });
  }
  const { id } = parsed;

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

    if (organiser.mergedIntoId) {
      const canonical = await serverClient.organiser.get.query({ id: organiser.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateOrganiserUrl(canonical.name, canonical.id), 301);
      }
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

  const shareUrl = `https://rasika.life${generateOrganiserUrl(organiser.name, organiser.id)}`;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: organiser.name, path: '#' },
        ]}
      />

      <DetailPageHeader
        title={organiser.name}
        subtitle="Event Organiser"
        shareUrl={shareUrl}
        shareTitle={`${organiser.name} - Rasika.life`}
        shareDescription={`Events organised by ${organiser.name}`}
        editUrl={user ? `${generateOrganiserUrl(organiser.name, organiser.id)}/edit` : undefined}
        isModerator={isModerator}
        mergeUrl={`/moderator/merge?entityType=organiser&entityId=${organiser.id}`}
        requestDeletionUrl={`/moderator/request-deletion?entityType=organiser&entityId=${organiser.id}`}
      />

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
