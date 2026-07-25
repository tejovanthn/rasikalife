import { Calendar } from 'lucide-react';
import { type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData, useParams, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateArtistUrl, generateEventUrl, parseSlug } from '~/lib/url-slug';
import { formatEventDate } from '~/lib/utils';

interface ArtistEvent {
  eventId: string;
  eventTitle: string;
  eventStartDateTime: string;
  artistName: string;
  artistTitle?: string;
  role?: string;
}

export const meta: MetaFunction = ({ data }) => {
  const loaderData = data as { artist: { id: string; name: string } } | undefined;
  if (!loaderData) return [{ title: 'Events - Rasika.life' }];
  const { artist } = loaderData;
  const canonicalUrl = `https://rasika.life${generateArtistUrl(artist.name, artist.id)}/events`;
  return [
    { title: `Events featuring ${artist.name} - Rasika.life` },
    {
      name: 'description',
      content: `Browse all past and upcoming events featuring ${artist.name} in Indian classical music.`,
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

export const loader: LoaderFunction = async ({ params, request }) => {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');

  const parsed = parseSlug(artistid);

  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const slugId = parsed.id;

  try {
    const artist = await client.artist.get.query({ id: slugId });

    const result = await client.event.byArtist.query({
      artistId: artist.id,
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      artist,
      events: result.items,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load artist events:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.ARTIST_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
    }
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      throw new Response('Artist not found', { status: 404 });
    }
    throw new Response('Failed to load events', { status: 500 });
  }
};

export default function ArtistEvents() {
  const { artistid } = useParams();

  const { artist, events, hasMore, nextToken } = useLoaderData<{
    artist: { id: string; name: string };
    events: ArtistEvent[];
    hasMore: boolean;
    nextToken: string | null;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Link
          to={`/artists/${artistid}`}
          className="text-primary hover:underline mb-2 inline-block"
        >
          &larr; Back to {artist.name}
        </Link>
        <h1 className="text-3xl font-bold">Events featuring {artist.name}</h1>
        <p className="text-muted-foreground mt-2">All past and upcoming events for {artist.name}</p>
      </div>
      {!events.length ? (
        <EmptyState
          message="No events found"
          description={`${artist.name} doesn't have any events in our database yet.`}
        />
      ) : (
        <>
          <div className="space-y-3">
            {events.map(event => (
              <Link
                key={event.eventId}
                to={generateEventUrl(event.eventTitle, event.eventId)}
                className="block no-underline"
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{event.eventTitle}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatEventDate(event.eventStartDateTime)}
                          </span>
                        </div>
                      </div>
                      {event.role && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {event.role}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl={`/artists/${artistid}/events`}
          />
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Artists', item: 'https://rasika.life/artists' },
          {
            name: artist.name,
            item: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
          },
          {
            name: 'Events',
            item: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}/events`,
          },
        ]}
      />
    </main>
  );
}
