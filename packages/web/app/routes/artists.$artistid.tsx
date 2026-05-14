import type { Edit } from '@rasika/core/domain/edit/client';
import { SOCIAL_PLATFORM_LABELS } from '@rasika/core/domain/social-link';
import type { ArtistType, CompositionWithRelations } from '@rasika/core/types/entities';
import { fromItrans } from '@rasika/core/utils';
import { Calendar, ExternalLink } from 'lucide-react';
import { type MetaFunction, data, redirect } from 'react-router';
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
import { scriptSessionResolver } from '~/sessions.server';

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
      throw new Response('Artist not found', { status: 410 });
    }

    if (artist.mergedIntoId) {
      const canonical = await client.artist.get.query({ id: artist.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateArtistUrl(canonical.name, canonical.id), 301);
      }
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

    const script = await scriptSessionResolver.getScript(request);
    const displayArtist = {
      ...artist,
      name: fromItrans(artist.name, script),
    };

    return data({
      artist: displayArtist,
      rawName: artist.name,
      compositions: result.items,
      hasMoreCompositions: result.hasMore,
      artistEvents: eventsResult.items,
      activeEdit,
      formattedDate: formatDate(artist.createdAt),
      isLoggedIn: !!user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.ARTIST_NOT_FOUND) {
        throw new Response('Artist not found', { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Artist not found', { status: 410 });
    }
    console.error('Failed to load artist:', error);
    throw new Response('Failed to load artist', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const { artist, rawName } = (data as { artist?: ArtistType; rawName?: string }) ?? {};
  const canonicalName = rawName ?? artist?.name ?? '';

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
        content: `https://rasika.life${generateArtistUrl(canonicalName, artist.id)}`,
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
        href: `https://rasika.life${generateArtistUrl(canonicalName, artist.id)}`,
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
    rawName: string;
    compositions: CompositionWithRelations[];
    hasMoreCompositions: boolean;
    artistEvents: ArtistEvent[];
    activeEdit: Edit | null;
    formattedDate: string;
    isModerator: boolean;
  }>();

  const {
    artist,
    rawName,
    compositions,
    hasMoreCompositions,
    artistEvents,
    activeEdit,
    formattedDate,
    isModerator,
  } = loaderData;

  const isNestedRoute =
    location.pathname.includes('/compositions') || location.pathname.includes('/events');

  const shareUrl = `https://rasika.life${generateArtistUrl(rawName, artist.id)}`;

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
      path: generateArtistUrl(rawName, artist.id),
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
        editUrl={isLoggedIn ? `${generateArtistUrl(rawName, artist.id)}/edit` : undefined}
        activeEdit={activeEdit}
        isModerator={isModerator}
        requestDeletionUrl={`/moderator/request-deletion?entityType=artist&entityId=${artist.id}`}
        mergeUrl={
          isModerator ? `/moderator/merge?entityType=artist&entityId=${artist.id}` : undefined
        }
      />
      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        {artist.biography && <p className="text-sm mb-4 whitespace-pre-line">{artist.biography}</p>}
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {artist.title ? `${artist.title} ${artist.name}` : artist.name}
          </p>
          {artist.birthYear && (
            <p>
              <strong>Born:</strong> {artist.birthYear}
              {artist.birthPlace ? `, ${artist.birthPlace}` : ''}
            </p>
          )}
          {artist.activeYears && (
            <p>
              <strong>Active:</strong> {artist.activeYears}
            </p>
          )}
          {artist.specialisations && (artist.specialisations as string[]).length > 0 && (
            <p>
              <strong>Specialisations:</strong> {(artist.specialisations as string[]).join(', ')}
            </p>
          )}
          {artist.gurus && (artist.gurus as Array<{ id?: string; name: string }>).length > 0 && (
            <p>
              <strong>Gurus:</strong>{' '}
              {(artist.gurus as Array<{ id?: string; name: string }>).map(g => g.name).join(', ')}
            </p>
          )}
          {artist.website && (
            <p>
              <strong>Website:</strong>{' '}
              <a
                href={artist.website as string}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {artist.website as string}
              </a>
            </p>
          )}
          <p>
            <strong>Added:</strong> {formattedDate}
          </p>
        </div>
      </section>

      {artist.socialLinks &&
        (artist.socialLinks as Array<{ platform: string; url: string }>).length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Social Links</h2>
            <div className="flex flex-wrap gap-3">
              {(artist.socialLinks as Array<{ platform: string; url: string }>).map(link => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-ext-arrow inline-flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {SOCIAL_PLATFORM_LABELS[link.platform as keyof typeof SOCIAL_PLATFORM_LABELS] ??
                    link.platform}
                </a>
              ))}
            </div>
          </section>
        )}
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
          <h2 className="text-2xl font-bold mb-4">Events</h2>
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
            to={`${generateArtistUrl(rawName, artist.id)}/events`}
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
            item: `https://rasika.life${generateArtistUrl(rawName, artist.id)}`,
          },
        ]}
      />
      <PersonStructuredData
        person={{
          name: artist.name,
          url: `https://rasika.life${generateArtistUrl(rawName, artist.id)}`,
        }}
      />
    </main>
  );
}
