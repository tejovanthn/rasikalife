import { Calendar, MapPin } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EmptyState } from '~/components/shared/EmptyState';
import { FestivalStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import {
  generateEventUrl,
  generateFestivalUrl,
  generateOrganiserUrl,
  parseSlug,
} from '~/lib/url-slug';

interface FestivalDetail {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  posterUrl?: string;
  organiserName?: string;
  organiserId?: string;
  tags?: string[];
  sponsors?: Array<{ name: string; type?: string }>;
}

interface FestivalEvent {
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
  const { festivalid } = params;
  if (!festivalid) {
    throw new Response('Festival ID is required', { status: 400 });
  }

  const parsed = parseSlug(festivalid);
  const id = parsed ? parsed.id : festivalid;

  try {
    const festival = await client.festival.get.query({ id });
    if (!festival) {
      throw new Response('Festival not found', { status: 404 });
    }

    const events = await client.event.byFestival.query({
      festivalId: id,
      limit: 50,
    });

    return data({ festival, events: events.items });
  } catch (error) {
    console.error('Failed to load festival:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.FESTIVAL_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Festival not found', { status: 404 });
    }
    throw new Response('Failed to load festival', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const festival = (loaderData as { festival: FestivalDetail } | undefined)?.festival;
  if (!festival) {
    return [{ title: 'Festival Not Found - Rasika.life' }];
  }

  const desc = festival.description || `${festival.name} - Indian classical arts festival`;

  return [
    { title: `${festival.name} - Rasika.life` },
    { name: 'description', content: desc },
    { property: 'og:title', content: festival.name },
    { property: 'og:description', content: desc },
    { property: 'og:type', content: 'website' },
    ...(festival.posterUrl ? [{ property: 'og:image', content: festival.posterUrl }] : []),
  ];
};

function groupEventsByDate(events: FestivalEvent[]): Map<string, FestivalEvent[]> {
  const groups = new Map<string, FestivalEvent[]>();
  for (const event of events) {
    const dateKey = event.startDateTime.split('T')[0];
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  }
  // Sort by date
  return new Map([...groups.entries()].sort());
}

export default function FestivalDetail() {
  const { festival, events } = useLoaderData<{
    festival: FestivalDetail;
    events: FestivalEvent[];
  }>();

  const groupedEvents = groupEventsByDate(events);

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Festivals', path: '/festivals' },
          { label: festival.name, path: '#' },
        ]}
      />

      <div className="mt-6 grid md:grid-cols-[250px_1fr] gap-8">
        {festival.posterUrl && (
          <img
            src={festival.posterUrl}
            alt={`${festival.name} poster`}
            className="w-full rounded-lg shadow-md"
          />
        )}

        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{festival.name}</h1>
          {festival.description && <p className="text-muted-foreground">{festival.description}</p>}

          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            <span>
              {new Date(festival.startDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
              {festival.startDate !== festival.endDate && (
                <>
                  {' - '}
                  {new Date(festival.endDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </>
              )}
            </span>
          </div>

          {festival.organiserName && (
            <p className="text-muted-foreground">
              Organised by{' '}
              {festival.organiserId ? (
                <Link
                  to={generateOrganiserUrl(festival.organiserName, festival.organiserId)}
                  className="text-primary"
                >
                  {festival.organiserName}
                </Link>
              ) : (
                <span className="font-medium">{festival.organiserName}</span>
              )}
            </p>
          )}

          {festival.tags && festival.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {festival.tags.map(tag => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      <section className="mt-10">
        <h2 className="section-heading mb-6">Schedule</h2>

        {events.length === 0 ? (
          <EmptyState message="No events scheduled yet." />
        ) : (
          <div className="space-y-8">
            {[...groupedEvents.entries()].map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">
                  {new Date(dateKey).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <div className="space-y-3">
                  {dayEvents
                    .sort(
                      (a, b) =>
                        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
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
                                  <span>
                                    {new Date(event.startDateTime).toLocaleTimeString('en-IN', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                    {event.endDateTime &&
                                      ` - ${new Date(event.endDateTime).toLocaleTimeString(
                                        'en-IN',
                                        {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                        }
                                      )}`}
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sponsors */}
      {festival.sponsors && festival.sponsors.length > 0 && (
        <section className="mt-8">
          <h2 className="section-heading mb-4">Sponsors</h2>
          <div className="flex gap-2 flex-wrap">
            {festival.sponsors.map(sponsor => (
              <Badge key={sponsor.name} variant="outline">
                {sponsor.name}
                {sponsor.type && ` (${sponsor.type})`}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <FestivalStructuredData
        festival={{
          name: festival.name,
          description: festival.description,
          startDate: festival.startDate,
          endDate: festival.endDate,
          organiserName: festival.organiserName,
          posterUrl: festival.posterUrl,
          url: `https://rasika.life${generateFestivalUrl(festival.name, festival.id)}`,
        }}
      />
    </main>
  );
}
