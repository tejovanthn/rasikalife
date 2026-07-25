import type { Artist, Collaborator, Guru } from '@rasika/core/domain/artist/client';
import { SOCIAL_PLATFORM_LABELS } from '@rasika/core/domain/social-link';
import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { Award, Calendar, ExternalLink, MapPin, Users } from 'lucide-react';
import { type MetaFunction, data, redirect } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import {
  BreadcrumbStructuredData,
  MusicGroupStructuredData,
  PersonStructuredData,
} from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { artistOgImageUrl } from '~/lib/og';
import {
  generateArtistUrl,
  generateCompositionUrl,
  generateEventUrl,
  generateRagaUrl,
  generateSlug,
  parseSlug,
} from '~/lib/url-slug';
import { formatEventDate } from '~/lib/utils';

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
    // The viewer only depends on the request, not the fetched artist, so start it
    // alongside the artist fetch rather than after it.
    const userPromise = getUser(request);
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

    const user = await userPromise;
    const isGroup = !!artist.isGroup;

    const [compositions, events, featured, awards, membership, gallery, repertoire, activeEdit] =
      await Promise.all([
        client.composition.byComposer.query({ composerId: artist.id, limit: 6 }),
        client.event.byArtist.query({ artistId: artist.id, limit: 6 }),
        client.artist.listFeaturedPerformances.query({ artistId: artist.id, limit: 4 }),
        client.artist.listAwards.query({ artistId: artist.id }),
        // A group lists its members; an individual lists the groups it performs in.
        // Only one direction is ever rendered, so only one is fetched.
        isGroup
          ? client.artist.listMembers.query({ groupId: artist.id })
          : client.artist.listGroups.query({ memberId: artist.id }),
        client.artist.listPhotos.query({ artistId: artist.id, limit: 12 }),
        client.artist.getRepertoire.query({ artistId: artist.id }),
        user
          ? client.edit.getActiveEditForEntity.query({ entityType: 'artist', entityId: artist.id })
          : Promise.resolve(null),
      ]);

    return data({
      artist,
      compositions: compositions.items,
      hasMoreCompositions: compositions.hasMore,
      artistEvents: events.items,
      featured,
      awards,
      membership,
      isGroup,
      galleryPhotos: gallery.items,
      repertoire,
      activeEdit,
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
  const { artist } = (data as { artist?: Artist }) ?? {};
  const canonicalName = artist?.name ?? '';

  if (artist) {
    const noun = artist.isGroup ? 'performing group' : 'artist';
    return [
      { title: `${artist.name} - Artist - Rasika.life` },
      {
        name: 'description',
        content: `Learn about ${artist.name}, a renowned ${noun} in Indian classical music. Discover their musical journey and contributions to classical traditions.`,
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
      { property: 'og:image', content: artistOgImageUrl(artist.id) },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'profile:first_name', content: artist.name.split(' ')[0] },
      { property: 'profile:last_name', content: artist.name.split(' ').slice(1).join(' ') },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: `${artist.name} - Artist` },
      { name: 'twitter:image', content: artistOgImageUrl(artist.id) },
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

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Photo, or an initial-based placeholder when the artist has none.
function HeroAvatar({ photoUrl, name }: { photoUrl?: string; name: string }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="h-24 w-24 shrink-0 rounded-full border object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border bg-muted text-3xl font-semibold text-muted-foreground"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function EventRow({
  eventId,
  eventTitle,
  eventStartDateTime,
  role,
}: { eventId: string; eventTitle: string; eventStartDateTime: string; role?: string }) {
  return (
    <Link to={generateEventUrl(eventTitle, eventId)} className="block no-underline">
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="py-3">
          <p className="font-medium text-foreground">{eventTitle}</p>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatEventDate(eventStartDateTime)}
            </span>
            {role && (
              <Badge variant="outline" className="text-xs">
                {role}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ArtistDetails() {
  const location = useLocation();

  const {
    artist: artistData,
    compositions,
    hasMoreCompositions,
    artistEvents,
    featured,
    awards,
    membership,
    isGroup,
    galleryPhotos,
    repertoire,
    activeEdit,
    isLoggedIn,
    isModerator,
  } = useLoaderData<typeof loader>();

  const artist = artistData as Artist;

  const isNestedRoute =
    location.pathname.includes('/compositions') ||
    location.pathname.includes('/events') ||
    location.pathname.includes('/gallery');

  if (isNestedRoute) {
    return <Outlet />;
  }

  const artistUrl = generateArtistUrl(artist.name, artist.id);
  const shareUrl = `https://rasika.life${artistUrl}`;

  const instrument = artist.instrument?.trim();
  const city = artist.city?.trim();
  const subtitle = instrument
    ? capitalise(instrument)
    : isGroup
      ? 'Performing group'
      : 'Indian classical music artist';

  const socialLinks = (artist.socialLinks as Array<{ platform: string; url: string }>) ?? [];
  const specialisations = (artist.specialisations as string[]) ?? [];
  const gurus = ((artist.gurus as Guru[]) ?? [])
    .slice()
    .sort(
      (a, b) => (a.fromYear ?? Number.POSITIVE_INFINITY) - (b.fromYear ?? Number.POSITIVE_INFINITY)
    );
  const collaborators = ((artist.collaborators as Collaborator[]) ?? [])
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 12);
  const galleryFeatured = galleryPhotos.filter(p => p.featured).slice(0, 6);

  // A featured performance also appears in the general events list; drop the overlap
  // so the same concert doesn't render twice.
  const featuredIds = new Set(featured.map(f => f.eventId));
  const otherEvents = artistEvents.filter(e => !featuredIds.has(e.eventId));

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Artists', path: '/artists' },
    { label: artist.name, path: artistUrl },
  ];

  const sameAs = [...socialLinks.map(l => l.url), artist.website].filter((u): u is string => !!u);
  const awardNames = awards.map(a => a.awardName);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />
      <DetailPageHeader
        title={artist.name}
        subtitle={subtitle}
        shareUrl={shareUrl}
        shareTitle={`${artist.name} - ${subtitle}`}
        shareDescription={`Learn about ${artist.name} and their contributions to Indian classical music`}
        editUrl={isLoggedIn ? `${artistUrl}/edit` : undefined}
        activeEdit={activeEdit}
        isModerator={isModerator}
        requestDeletionUrl={`/moderator/request-deletion?entityType=artist&entityId=${artist.id}`}
        mergeUrl={
          isModerator ? `/moderator/merge?entityType=artist&entityId=${artist.id}` : undefined
        }
      />

      {/* Hero — photo + identity */}
      <section className="mb-8 flex items-start gap-5">
        <HeroAvatar photoUrl={artist.photoUrl} name={artist.name} />
        <div className="min-w-0">
          {artist.title && <p className="text-sm text-muted-foreground">{artist.title}</p>}
          <p className="text-lg font-medium">
            {[instrument ? capitalise(instrument) : null, city].filter(Boolean).join(' · ') ||
              subtitle}
          </p>
          {city && !instrument && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {city}
            </p>
          )}
          {(socialLinks.length > 0 || artist.website) && (
            <div className="mt-3 flex flex-wrap gap-3">
              {artist.website && (
                <a
                  href={artist.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-ext-arrow inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Website
                </a>
              )}
              {socialLinks.map(link => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-ext-arrow inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {SOCIAL_PLATFORM_LABELS[link.platform as keyof typeof SOCIAL_PLATFORM_LABELS] ??
                    link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About — the main crawlable text block, placed high */}
      {(artist.biography ||
        artist.birthYear ||
        artist.activeYears ||
        specialisations.length > 0) && (
        <section className="mb-8 rounded-lg bg-muted p-6">
          <h2 className="mb-4 text-xl font-semibold">About</h2>
          {artist.biography && (
            <p className="mb-4 whitespace-pre-line text-sm">{artist.biography}</p>
          )}
          <div className="space-y-2 text-sm">
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
            {specialisations.length > 0 && (
              <p>
                <strong>Specialisations:</strong> {specialisations.join(', ')}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Awards */}
      {awards.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
            <Award className="h-5 w-5" />
            Awards & honours
          </h2>
          <ul className="space-y-2">
            {awards.map(award => (
              <li key={award.awardId} className="text-sm">
                <span className="font-medium">{award.awardName}</span>
                {award.year ? <span className="text-muted-foreground"> · {award.year}</span> : null}
                {award.category ? (
                  <span className="text-muted-foreground"> · {award.category}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gurus / lineage */}
      {gurus.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Gurus & lineage</h2>
          <ul className="space-y-2 text-sm">
            {gurus.map((guru, i) => {
              const years = [guru.fromYear, guru.toYear].filter(Boolean).join('–');
              return (
                <li key={guru.id ?? `${guru.name}-${i}`}>
                  {guru.id ? (
                    <Link
                      to={generateArtistUrl(guru.name, guru.id)}
                      className="font-medium hover:underline"
                    >
                      {guru.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{guru.name}</span>
                  )}
                  {guru.discipline ? (
                    <span className="text-muted-foreground"> · {guru.discipline}</span>
                  ) : null}
                  {years ? <span className="text-muted-foreground"> ({years})</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Compositions teaser */}
      {compositions.length > 0 && (
        <EntityCompositions
          compositions={compositions as CompositionWithRelations[]}
          entityType="artist"
          entitySlug={`${generateSlug(artist.name)}-${artist.id}`}
          showViewMore={hasMoreCompositions}
          customHeading={`Compositions by ${artist.name}`}
        />
      )}

      {/* Repertoire — most-performed, derived from logged concerts */}
      {(repertoire.topCompositions.length > 0 || repertoire.topRagas.length > 0) && (
        <section className="mt-8 border-t pt-8">
          <h2 className="mb-4 text-xl font-semibold">Repertoire</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {repertoire.topCompositions.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Most performed compositions
                </h3>
                <ul className="space-y-2">
                  {repertoire.topCompositions.slice(0, 5).map(comp => (
                    <li key={comp.id} className="flex items-center justify-between gap-4">
                      <Link
                        to={generateCompositionUrl(comp.title, comp.id)}
                        className="truncate text-sm underline-offset-2 hover:underline"
                      >
                        {comp.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{comp.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {repertoire.topRagas.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Most performed ragas
                </h3>
                <ul className="space-y-2">
                  {repertoire.topRagas.slice(0, 5).map(raga => (
                    <li key={raga.id} className="flex items-center justify-between gap-4">
                      <Link
                        to={generateRagaUrl(raga.name, raga.id)}
                        className="truncate text-sm underline-offset-2 hover:underline"
                      >
                        {raga.name}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{raga.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Derived from logged concerts</p>
        </section>
      )}

      {/* Notable performances — featured past */}
      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Notable performances</h2>
          <div className="space-y-3">
            {featured.map(f => (
              <EventRow
                key={f.eventId}
                eventId={f.eventId}
                eventTitle={f.eventTitle}
                eventStartDateTime={f.eventStartDateTime}
                role={f.role}
              />
            ))}
          </div>
        </section>
      )}

      {/* Events */}
      {otherEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Events</h2>
          <div className="space-y-3">
            {otherEvents.map(event => (
              <EventRow
                key={event.eventId}
                eventId={event.eventId}
                eventTitle={event.eventTitle}
                eventStartDateTime={event.eventStartDateTime}
                role={event.role}
              />
            ))}
          </div>
          <Link to={`${artistUrl}/events`} className="mt-3 inline-block text-sm text-primary">
            View all events &rarr;
          </Link>
        </section>
      )}

      {/* Gallery teaser — featured photos, hidden entirely when none */}
      {galleryFeatured.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Gallery</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galleryFeatured.map(photo => (
              <figure key={photo.id} className="overflow-hidden rounded-lg border">
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ?? artist.name}
                  className="aspect-square w-full object-cover"
                />
                {photo.caption && (
                  <figcaption className="px-2 py-1 text-xs text-muted-foreground">
                    {photo.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
          <Link to={`${artistUrl}/gallery`} className="mt-3 inline-block text-sm text-primary">
            View all photos &rarr;
          </Link>
        </section>
      )}

      {/* Members / Groups — group-aware */}
      {membership.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5" />
            {isGroup ? 'Members' : 'Performs as'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {membership.map(m => {
              const linkedName = isGroup ? m.memberName : m.groupName;
              const linkedId = isGroup ? m.memberId : m.groupId;
              return (
                <Link
                  key={linkedId}
                  to={generateArtistUrl(linkedName, linkedId)}
                  className="rounded-full border px-3 py-1 text-sm transition-colors hover:border-primary/50"
                >
                  {linkedName}
                  {m.role ? <span className="text-muted-foreground"> · {m.role}</span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Frequent collaborators */}
      {collaborators.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Frequent collaborators</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {collaborators.map(c => (
              <Link
                key={c.artistId}
                to={generateArtistUrl(c.name, c.artistId)}
                className="rounded-lg border p-3 transition-colors hover:border-primary/50"
              >
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.topRoles && c.topRoles.length > 0 ? `${c.topRoles.join(', ')} · ` : ''}
                  {c.sharedEventCount} shared {c.sharedEventCount === 1 ? 'event' : 'events'}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore more */}
      <section className="mt-8 border-t pt-8">
        <h2 className="mb-4 text-xl font-semibold">Explore More</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/artists"
            className="rounded-lg bg-muted/50 p-4 text-center transition-colors hover:bg-muted"
          >
            <h3 className="font-medium">All Artists</h3>
            <p className="text-sm text-muted-foreground">Browse other musicians</p>
          </Link>
          <Link
            to="/carnatic/compositions"
            className="rounded-lg bg-muted/50 p-4 text-center transition-colors hover:bg-muted"
          >
            <h3 className="font-medium">Compositions</h3>
            <p className="text-sm text-muted-foreground">Explore musical works</p>
          </Link>
          <Link
            to="/carnatic"
            className="rounded-lg bg-muted/50 p-4 text-center transition-colors hover:bg-muted"
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
          { name: artist.name, item: shareUrl },
        ]}
      />
      {isGroup ? (
        <MusicGroupStructuredData
          group={{
            name: artist.name,
            url: shareUrl,
            image: artist.photoUrl,
            sameAs,
            awards: awardNames,
            members: membership.map(m => ({
              name: m.memberName,
              url: `https://rasika.life${generateArtistUrl(m.memberName, m.memberId)}`,
            })),
          }}
        />
      ) : (
        <PersonStructuredData
          person={{
            name: artist.name,
            url: shareUrl,
            image: artist.photoUrl,
            sameAs,
            awards: awardNames,
            memberOf: membership.map(m => ({
              name: m.groupName,
              url: `https://rasika.life${generateArtistUrl(m.groupName, m.groupId)}`,
            })),
          }}
        />
      )}
    </main>
  );
}
