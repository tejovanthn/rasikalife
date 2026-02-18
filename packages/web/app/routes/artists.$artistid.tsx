import type { Edit } from '@rasika/core/domain/edit/client';
import type { ArtistType, CompositionWithRelations } from '@rasika/core/types/entities';
import { Calendar } from 'lucide-react';
import { type MetaFunction, data } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { BreadcrumbStructuredData, PersonStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateArtistOGImage } from '~/lib/og';
import { generateArtistUrl, generateEventUrl, generateSlug, parseSlug } from '~/lib/url-slug';
import { formatDate } from '~/lib/utils';

export async function loader({
  params,
  request,
}: { params: { artistid?: string }; request: Request }) {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const parsed = parseSlug(artistid);

  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;

  try {
    const client = await createServerClient(request);
    const artist = await client.artist.get.query({ id: slugId });

    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }

    const [result, eventsResult] = await Promise.all([
      client.composition.byComposer.query({
        composerId: artist.id,
        limit: 6,
      }),
      client.event.byArtist.query({
        artistId: artist.id,
        limit: 6,
      }),
    ]);

    const user = await getUser(request);
    let activeEdit: Edit | null = null;
    if (user) {
      activeEdit = await client.edit.getActiveEditForEntity.query({
        entityType: 'artist',
        entityId: artist.id,
      });
    }

    return data({
      artist,
      compositions: result.items,
      hasMoreCompositions: result.hasMore,
      artistEvents: eventsResult.items,
      activeEdit,
      formattedDate: formatDate(artist.createdAt),
    });
  } catch (error) {
    console.error('Failed to load artist:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.ARTIST_NOT_FOUND) {
        throw new Response('Artist not found', { status: 404 });
      }
    }
    // Check if it's a "not found" type error from the API
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Artist not found', { status: 404 });
    }
    throw new Response('Failed to load artist', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const artistData = data as { artist?: ArtistType } | undefined;
  const artist = artistData?.artist;

  if (artist) {
    return [
      { title: `${artist.name} - Artist - Rasika.life` },
      {
        name: 'description',
        content: `Learn about ${artist.name}, a renowned artist in Indian classical music. Discover their musical journey and contributions to classical traditions.`,
      },
      {
        name: 'keywords',
        content: `${artist.name}, Indian classical music artist, Carnatic musician, Hindustani artist, classical music`,
      },
      { property: 'og:title', content: `${artist.name} - Indian Classical Music Artist` },
      {
        property: 'og:description',
        content: `Learn about ${artist.name} and their contributions to Indian classical music`,
      },
      { property: 'og:type', content: 'profile' },
      {
        property: 'og:url',
        content: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
      },
      {
        property: 'og:image',
        content: generateArtistOGImage(artist),
      },
      { property: 'profile:first_name', content: artist.name.split(' ')[0] },
      { property: 'profile:last_name', content: artist.name.split(' ').slice(1).join(' ') },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${artist.name} - Artist` },
      { name: 'twitter:description', content: `Indian classical music artist ${artist.name}` },
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
      },
    ];
  }

  return [
    { title: 'Artist - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about artists in Indian classical music.',
    },
  ];
};

export default function ArtistDetails() {
  const location = useLocation();

  interface ArtistEvent {
    eventId: string;
    eventTitle: string;
    eventStartDateTime: string;
    artistName: string;
    artistTitle?: string;
    role?: string;
  }

  const loaderData = useLoaderData<{
    artist: ArtistType;
    compositions: CompositionWithRelations[];
    hasMoreCompositions: boolean;
    artistEvents: ArtistEvent[];
    activeEdit: Edit | null;
    formattedDate: string;
  }>();

  const { artist, compositions, hasMoreCompositions, artistEvents, activeEdit, formattedDate } =
    loaderData;

  const isNestedRoute =
    location.pathname.includes('/compositions') || location.pathname.includes('/events');

  const shareUrl = `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`;

  const specializations = [
    ...new Set(artistEvents.map(e => e.role).filter((r): r is string => !!r)),
  ].map(role => `${role.charAt(0).toUpperCase()}${role.slice(1)} Artist`);
  const subtitle =
    specializations.length > 0 ? specializations.join(' & ') : 'Indian Classical Music Artist';

  if (isNestedRoute) {
    return <Outlet />;
  }

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Artists', path: '/artists' },
    {
      label: artist.name,
      path: generateArtistUrl(artist.name, artist.id),
    },
  ];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />
      <DetailPageHeader
        title={artist.name}
        subtitle={subtitle}
        shareUrl={shareUrl}
        shareTitle={`${artist.name} - ${subtitle}`}
        shareDescription={`Learn about ${artist.name} and their contributions to Indian classical music`}
        editUrl={`${generateArtistUrl(artist.name, artist.id)}/edit`}
        activeEdit={activeEdit}
      />
      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {artist.name}
          </p>
          <p>
            <strong>Added:</strong> {formattedDate}
          </p>
        </div>
      </section>
      {compositions.length > 0 && (
        <EntityCompositions
          compositions={compositions}
          entityType="artist"
          entitySlug={`${generateSlug(artist.name)}-${artist.id}`}
          showViewMore={hasMoreCompositions}
          customHeading={`Compositions by ${artist.name}`}
        />
      )}
      {artistEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="section-heading mb-4">Events</h2>
          <div className="space-y-3">
            {artistEvents.map(event => (
              <Link
                key={event.eventId}
                to={generateEventUrl(event.eventTitle, event.eventId)}
                className="block no-underline"
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="py-3">
                    <p className="font-medium text-foreground">{event.eventTitle}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.eventStartDateTime).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {event.role && (
                        <Badge variant="outline" className="text-xs">
                          {event.role}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <Link
            to={`${generateArtistUrl(artist.name, artist.id)}/events`}
            className="inline-block mt-3 text-sm text-primary"
          >
            View all events &rarr;
          </Link>
        </section>
      )}

      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore More</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/artists"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Artists</h3>
            <p className="text-sm text-muted-foreground">Browse other musicians</p>
          </Link>

          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Compositions</h3>
            <p className="text-sm text-muted-foreground">Explore musical works</p>
          </Link>

          <Link
            to="/carnatic"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Carnatic Music</h3>
            <p className="text-sm text-muted-foreground">Discover the tradition</p>
          </Link>
        </div>
      </section>

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Artists', item: 'https://rasika.life/artists' },
          {
            name: artist.name,
            item: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
          },
        ]}
      />
      <PersonStructuredData
        person={{
          name: artist.name,
          url: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
        }}
      />
    </main>
  );
}
