import { Calendar, ExternalLink, MapPin } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EmptyState } from '~/components/shared/EmptyState';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateEventUrl, parseSlug } from '~/lib/url-slug';

interface VenueDetail {
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  mapLink?: string;
}

interface EventItem {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
}

export const loader: LoaderFunction = async ({ params }) => {
  const { venueid } = params;
  if (!venueid) {
    throw new Response('Venue ID is required', { status: 400 });
  }

  const parsed = parseSlug(venueid);
  const id = parsed ? parsed.id : venueid;

  try {
    const [venue, eventsResult] = await Promise.all([
      client.venue.get.query({ id }),
      client.event.byVenue.query({ venueId: id, limit: 50 }),
    ]);

    if (!venue) {
      throw new Response('Venue not found', { status: 404 });
    }

    return data({ venue, events: eventsResult.items });
  } catch (error) {
    console.error('Failed to load venue:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.VENUE_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Venue not found', { status: 404 });
    }
    throw new Response('Failed to load venue', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const venue = (loaderData as { venue: VenueDetail } | undefined)?.venue;
  if (!venue) {
    return [{ title: 'Venue Not Found - Rasika.life' }];
  }

  const locationParts = [venue.address?.city, venue.address?.state].filter(Boolean);
  const locationStr = locationParts.length > 0 ? ` in ${locationParts.join(', ')}` : '';

  return [
    { title: `${venue.name} - Venue - Rasika.life` },
    {
      name: 'description',
      content: `Events and performances at ${venue.name}${locationStr}. Indian classical arts venue.`,
    },
  ];
};

function formatAddress(address: VenueDetail['address']): string | null {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.postalCode, address.country];
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : null;
}

export default function VenueDetailPage() {
  const { venue, events } = useLoaderData<{
    venue: VenueDetail;
    events: EventItem[];
  }>();

  const addressStr = formatAddress(venue.address);

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: venue.name, path: '#' },
        ]}
      />

      <div className="mt-6 space-y-4">
        <h1 className="text-3xl font-bold">{venue.name}</h1>

        {addressStr && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <span>{addressStr}</span>
          </div>
        )}

        {venue.mapLink && (
          <a
            href={venue.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            View on Map
          </a>
        )}
      </div>

      <section className="mt-10">
        <h2 className="section-heading mb-6">Events at this venue</h2>

        {events.length === 0 ? (
          <EmptyState message="No upcoming events at this venue." />
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
