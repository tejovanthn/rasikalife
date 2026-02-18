import { Calendar, MapPin } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EmptyState } from '~/components/shared/EmptyState';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateEventUrl, parseSlug } from '~/lib/url-slug';

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

export const loader: LoaderFunction = async ({ params }) => {
  const { organiserid } = params;
  if (!organiserid) {
    throw new Response('Organiser ID is required', { status: 400 });
  }

  const parsed = parseSlug(organiserid);
  const id = parsed ? parsed.id : organiserid;

  try {
    const [organiser, eventsResult] = await Promise.all([
      client.organiser.get.query({ id }),
      client.event.byOrganiser.query({ organiserId: id, limit: 50 }),
    ]);

    if (!organiser) {
      throw new Response('Organiser not found', { status: 404 });
    }

    return data({ organiser, events: eventsResult.items });
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
  const { organiser, events } = useLoaderData<{
    organiser: OrganiserDetail;
    events: EventItem[];
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
        <h1 className="text-3xl font-bold">{organiser.name}</h1>
        <p className="text-muted-foreground mt-1">Event Organiser</p>
      </div>

      <section className="mt-10">
        <h2 className="section-heading mb-6">Events</h2>

        {events.length === 0 ? (
          <EmptyState message="No events by this organiser yet." />
        ) : (
          <div className="space-y-3">
            {events
              .sort(
                (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
              )
              .map(event => (
                <Link
                  key={event.id}
                  to={generateEventUrl(event.title, event.id)}
                  className="block no-underline"
                >
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{event.title}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(event.startDateTime).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                              {', '}
                              {new Date(event.startDateTime).toLocaleTimeString('en-IN', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                            {event.venueName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.venueName}
                              </span>
                            )}
                          </div>
                          {event.artists && event.artists.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {event.artists
                                .map(a => `${a.title ? `${a.title} ` : ''}${a.name}`)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        {event.entryType && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {event.entryType}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
