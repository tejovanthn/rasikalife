import { Calendar, MapPin, Plus } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { useAuth } from '~/components/auth-context';
import { EmptyState } from '~/components/shared/EmptyState';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { generateEventUrl } from '~/lib/url-slug';

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
          <div className="space-y-4">
            {events.map(event => (
              <Link
                key={event.id}
                to={generateEventUrl(event.title, event.id)}
                className="block no-underline"
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex gap-4">
                      {event.posterUrl && (
                        <img
                          src={event.posterUrl}
                          alt=""
                          className="w-20 h-20 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-lg truncate text-foreground">
                          {event.title}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
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
                              <MapPin className="h-3.5 w-3.5" />
                              {event.venueName}
                            </span>
                          )}
                        </div>
                        {event.artists && event.artists.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {event.artists
                              .map(a => `${a.title ? `${a.title} ` : ''}${a.name}`)
                              .join(', ')}
                          </p>
                        )}
                        {event.tags && event.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {event.tags.slice(0, 4).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {event.entryType && (
                              <Badge variant="secondary" className="text-xs">
                                {event.entryType}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
    </main>
  );
}
