import { type HeadersFunction, type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData, useParams, useSearchParams } from 'react-router';
// Unauthenticated client: this subroute renders only public event data and no per-viewer
// chrome, so it is safe to fetch without a session and cache publicly.
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { roleLabel } from '~/lib/artist-display';
import { PRIVATE_PAGE_CACHE_CONTROL, publicPageCacheControl } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateArtistUrl, generateEventUrl, parseSlug } from '~/lib/url-slug';
import { formatEventDate } from '~/lib/utils';

// This page's own content is identical for every viewer, but the document it ships in is
// not: the root loader renders the signed-in viewer's name and email into the header. The
// loader decides per request (see publicPageCacheControl); this only forwards the decision,
// defaulting to private so a loader that somehow set nothing is never shared-cached.
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? PRIVATE_PAGE_CACHE_CONTROL,
});

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
    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }

    // Past events are the long list, so they own the pagination: newest first, walking
    // backwards. Upcoming dates are few and belong at the top, so they are fetched whole
    // and only on the first page — carrying them down every page would repeat them.
    const [upcoming, past] = await Promise.all([
      nextToken
        ? Promise.resolve({ items: [] })
        : client.event.byArtist.query({ artistId: artist.id, limit: 50, when: 'upcoming' }),
      client.event.byArtist.query({
        artistId: artist.id,
        limit: 20,
        when: 'past',
        nextToken: nextToken || undefined,
      }),
    ]);

    return data(
      {
        artist,
        upcoming: upcoming.items,
        events: past.items,
        hasMore: past.hasMore,
        nextToken: past.nextToken,
        prevToken: nextToken,
      },
      { headers: { 'Cache-Control': await publicPageCacheControl(request) } }
    );
  } catch (error) {
    if (error instanceof Response) throw error;
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

/** One credit as a hairline row: date first, then the concert and what this artist did in it. */
function EventCard({ event }: { event: ArtistEvent }) {
  return (
    <Link
      to={generateEventUrl(event.eventTitle, event.eventId)}
      className="flex gap-3 rounded-sm px-2 py-3 no-underline transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <time
        dateTime={event.eventStartDateTime}
        className="w-[4.5rem] shrink-0 text-sm font-semibold tabular-nums text-foreground"
      >
        {formatEventDate(event.eventStartDateTime)}
      </time>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-foreground line-clamp-2">{event.eventTitle}</p>
        {event.role && (
          <p className="mt-0.5 text-sm text-muted-foreground">{roleLabel(event.role)}</p>
        )}
      </div>
    </Link>
  );
}

export default function ArtistEvents() {
  const { artistid } = useParams();

  const { artist, upcoming, events, hasMore, nextToken } = useLoaderData<{
    artist: { id: string; name: string };
    upcoming: ArtistEvent[];
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
      {!events.length && !upcoming.length ? (
        <EmptyState
          message="No events found"
          description={`${artist.name} doesn't have any events in our database yet.`}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Upcoming
              </h2>
              <ul className="divide-y divide-border">
                {upcoming.map(event => (
                  <li key={event.eventId}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {events.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Past
              </h2>
              <ul className="divide-y divide-border">
                {events.map(event => (
                  <li key={event.eventId}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          )}

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
