import type { Artist } from '@rasika/core/domain/artist/client';
import { SOCIAL_PLATFORM_LABELS } from '@rasika/core/domain/social-link';
import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { Award, BadgeCheck, ExternalLink, Users } from 'lucide-react';
import {
  type ActionFunctionArgs,
  type HeadersFunction,
  type MetaFunction,
  data,
  redirect,
} from 'react-router';
import { Link, useFetcher, useLoaderData } from 'react-router';
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
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { artistTagline } from '~/lib/artist-display';
import { PRIVATE_PAGE_CACHE_CONTROL, PUBLIC_PAGE_CACHE_CONTROL, getUser } from '~/lib/auth.server';
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
import { capitalize, formatEventDate } from '~/lib/utils';

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
    // Typed as the browser-safe Artist here so the component reads its fields (socialLinks,
    // gurus, collaborators, denormalized repertoire/featured) without per-field casts.
    const artist = (await client.artist.get.query({ id: slugId })) as Artist | null;

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

    const [compositions, upcoming, past, awards, membership, gallery, activeEdit, myClaim] =
      await Promise.all([
        client.composition.byComposer.query({ composerId: artist.id, limit: 6 }),
        // Two sides of the same partition rather than one unbounded read: the GSI sorts
        // ascending, so a single query would hand back the artist's oldest concerts and
        // never the date they are about to play.
        client.event.byArtist.query({ artistId: artist.id, limit: 4, when: 'upcoming' }),
        client.event.byArtist.query({ artistId: artist.id, limit: 6, when: 'past' }),
        client.artist.listAwards.query({ artistId: artist.id }),
        // A group lists its members; an individual lists the groups it performs in.
        // Only one direction is ever rendered, so only one is fetched.
        isGroup
          ? client.artist.listMembers.query({ groupId: artist.id })
          : client.artist.listGroups.query({ memberId: artist.id }),
        // 24, matching the gallery page's own page size. The teaser prefers featured photos
        // but there is no featured-first index — they are selected in memory from this page
        // of rows, so a low limit silently ignores anything featured further down the order.
        client.artist.listPhotos.query({ artistId: artist.id, limit: 24 }),
        user
          ? client.edit.getActiveEditForEntity.query({ entityType: 'artist', entityId: artist.id })
          : Promise.resolve(null),
        // Signed-in viewers only, and only on the branch that is already uncacheable — the
        // anonymous document must stay identical for everyone or the CDN would hand one
        // viewer's claim state to the next. The public verified badge comes from the artist
        // row's denormalized claimStatus instead, which costs nothing and varies by nobody.
        user
          ? client.artistClaim.myStatusFor.query({ artistId: artist.id })
          : Promise.resolve(null),
      ]);

    // Posters are the page's main visual layer, and the EventArtist junction copies the title
    // and start time but not posterUrl, so the teaser's events have to be read back. One
    // BatchGetItem for the whole teaser, not a point read each, and only for the handful of
    // ids actually rendered. The anonymous document is edge-cached for 120s on top of that.
    const teaserEventIds = [
      ...new Set([
        ...upcoming.items.map(e => e.eventId),
        ...past.items.map(e => e.eventId),
        ...(artist.featuredPerformances ?? []).slice(0, 4).map(f => f.eventId),
      ]),
    ].slice(0, 24);
    const teaserEvents = teaserEventIds.length
      ? await client.event.byIds.query({ ids: teaserEventIds })
      : [];
    const postersByEventId: Record<string, string> = {};
    for (const event of teaserEvents) {
      if (event.posterUrl) postersByEventId[event.id] = event.posterUrl;
    }

    // Repertoire and featured performances are read straight off the denormalized fields
    // on the artist record — no per-view setlist fan-out, no filtered partition scan.
    // Featured is stored pre-sorted by setEventArtistFeatured, so the teaser just slices.
    const repertoire = {
      topCompositions: artist.topCompositions ?? [],
      topRagas: artist.topRagas ?? [],
    };
    const featured = (artist.featuredPerformances ?? []).slice(0, 4);

    // Anonymous views are identical and safe to serve from the CDN edge; signed-in views
    // carry per-viewer chrome and, through the root loader, the viewer's own name and email,
    // so they stay private. SST's server cache policy sets cookieBehavior: "none", which is
    // exactly why this cannot be a static `public` header — see publicPageCacheControl.
    //
    // This route has the verified user in hand, so it decides on that rather than on the
    // cookie the subroutes have to settle for. Same two values, one definition.
    const cacheControl = user ? PRIVATE_PAGE_CACHE_CONTROL : PUBLIC_PAGE_CACHE_CONTROL;

    return data(
      {
        artist,
        compositions: compositions.items,
        hasMoreCompositions: compositions.hasMore,
        upcomingEvents: upcoming.items,
        pastEvents: past.items,
        postersByEventId,
        featured,
        awards,
        membership,
        isGroup,
        galleryPhotos: gallery.items,
        repertoire,
        activeEdit,
        isLoggedIn: !!user,
        myClaimStatus: myClaim?.status,
        isModerator: user?.role === 'moderator' || user?.role === 'admin',
      },
      { headers: { 'Cache-Control': cacheControl } }
    );
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

// Claiming a profile (§8). The claimant is taken from the session inside the router, never
// from this form, so the only thing posted is which artist and an optional note.
export async function action({ request, params }: ActionFunctionArgs) {
  const parsed = params.artistid ? parseSlug(params.artistid) : null;
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }
  const artistId = parsed.id;

  const formData = await request.formData();
  const note = ((formData.get('note') as string) || '').trim() || undefined;

  try {
    const client = await createServerClient(request);
    await client.artistClaim.create.mutate({ artistId, note });
    return data({ success: true });
  } catch (error) {
    console.error('Failed to submit claim:', error);
    const message =
      error instanceof Error && error.message.includes('already claimed')
        ? 'You have already claimed this artist.'
        : 'Could not submit that claim.';
    return data({ error: message }, { status: 400 });
  }
}

// For a document request the loader's Cache-Control isn't applied to the HTML response
// unless a route forwards it here. Default to private so a loader that somehow set nothing
// is never shared-cached.
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? PRIVATE_PAGE_CACHE_CONTROL,
});

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

// Photo, or an initial-based placeholder when the artist has none.
// The three states a signed-in viewer can be in for this artist. An invited artist never sees
// any of it: their invite is redeemed into a verified claim at login, so they arrive already
// managing the profile (§4.3.1).
function ClaimProfile({
  artistName,
  status,
  isLoggedIn,
  claimStatus,
}: { artistName: string; status?: string; isLoggedIn: boolean; claimStatus?: string }) {
  const fetcher = useFetcher<{ success?: true; error?: string }>();

  // Somebody already manages this profile, so there is nothing to offer. `claimStatus` is
  // the artist's own denormalized badge, not the viewer's, so this is viewer-invariant and
  // must be tested before the signed-out branch below — which otherwise asked passers-by to
  // claim a profile displaying a Verified badge two sections up.
  if (claimStatus === 'verified' && status !== 'verified') return null;

  // Logged-out visitors are nearly the whole audience, and an artist arriving at their own
  // page is exactly the person §8 is addressing — hiding the entry point behind a session
  // hides it from them. This branch is viewer-invariant, so the anonymous document stays
  // identical for everyone and edge-cacheable; only the stateful variants below need a user.
  if (!isLoggedIn) {
    return (
      <section className="mt-8 rounded-md border p-4">
        <p className="text-sm text-muted-foreground">
          Are you {artistName}?{' '}
          <Link to="/auth/login" className="text-primary hover:underline">
            Sign in to claim this profile
          </Link>
          .
        </p>
      </section>
    );
  }

  if (status === 'verified') {
    return (
      <section className="mt-8 rounded-md border bg-muted/40 p-4">
        <p className="text-sm">You manage this profile.</p>
      </section>
    );
  }

  if (status === 'pending' || fetcher.data?.success) {
    return (
      <section className="mt-8 rounded-md border bg-muted/40 p-4">
        <p className="text-sm">
          Your claim is with a moderator. They may get in touch to confirm who you are.
        </p>
      </section>
    );
  }

  // A rejected claim shows nothing rather than inviting an immediate re-submission — core
  // rejects a duplicate anyway, and re-asking is a conversation for a human, not a button.
  if (status === 'rejected') return null;

  // <details> rather than a useState toggle: the disclosure then works before hydration, like
  // the rest of this server-rendered page, and there is no state to keep.
  return (
    <section className="mt-8 rounded-md border p-4">
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Are you {artistName}? Claim this profile
        </summary>
        <fetcher.Form method="post" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Tell us how we can confirm it&rsquo;s you — an official email address, a social account
            you post from, anything a moderator can check.
          </p>
          {/* Single-field disclosure form under its own <summary> — a visible Label would
              just repeat that line, so this stays label-free per DESIGN.md density rule. */}
          <Input
            name="note"
            placeholder="How can we verify you?"
            aria-label="How can we verify you?"
          />
          {/* Default size, not sm. This is a public action on a page many people reach on a
              phone, and PRODUCT.md holds touch targets to 44px; sm is 36. */}
          <Button type="submit" className="min-h-11" disabled={fetcher.state !== 'idle'}>
            {fetcher.state === 'idle' ? 'Send claim' : 'Sending…'}
          </Button>
          {fetcher.data?.error && <p className="text-xs text-destructive">{fetcher.data.error}</p>}
        </fetcher.Form>
      </details>
    </section>
  );
}

function HeroAvatar({ photoUrl, name }: { photoUrl?: string; name: string }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="h-28 w-28 shrink-0 rounded-full border object-cover sm:h-32 sm:w-32"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border bg-muted text-4xl font-semibold text-muted-foreground sm:h-32 sm:w-32"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function EventCard({
  eventId,
  eventTitle,
  eventStartDateTime,
  role,
  posterUrl,
}: {
  eventId: string;
  eventTitle: string;
  eventStartDateTime: string;
  role?: string;
  posterUrl?: string;
}) {
  // A card here, not the hairline row this replaced. The row was right when it carried a date
  // and a title and nothing else: a bordered box around three words is furniture. A poster is
  // real content, and on a page whose only other image is one portrait it is most of the
  // visual weight the profile has.
  //
  // Posters are portrait, so the thumbnail is 3:4 and fixed-width; an event with no poster
  // gets a date block in the same footprint rather than a ragged card, so a mixed row still
  // lines up.
  return (
    <Link
      to={generateEventUrl(eventTitle, eventId)}
      className="group flex gap-3 rounded-lg border p-3 no-underline transition-colors hover:border-primary/50"
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          className="h-24 w-[4.5rem] shrink-0 rounded object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-24 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded bg-muted text-muted-foreground"
        >
          <span className="text-xl font-semibold tabular-nums leading-none">
            {new Date(eventStartDateTime).getUTCDate()}
          </span>
          <span className="mt-1 text-[0.65rem] uppercase tracking-wide">
            {formatEventDate(eventStartDateTime).split(' ')[1] ?? ''}
          </span>
        </div>
      )}
      <div className="flex min-w-0 flex-col justify-center">
        <time dateTime={eventStartDateTime} className="text-xs tabular-nums text-muted-foreground">
          {formatEventDate(eventStartDateTime)}
        </time>
        <p className="mt-0.5 font-medium leading-snug text-foreground group-hover:underline">
          {eventTitle}
        </p>
        {role && <p className="mt-1 text-xs text-muted-foreground">{role}</p>}
      </div>
    </Link>
  );
}

export default function ArtistDetails() {
  const {
    artist,
    compositions,
    hasMoreCompositions,
    upcomingEvents,
    pastEvents,
    postersByEventId,
    featured,
    awards,
    membership,
    isGroup,
    galleryPhotos,
    repertoire,
    activeEdit,
    isLoggedIn,
    isModerator,
    myClaimStatus,
  } = useLoaderData<typeof loader>();

  const artistUrl = generateArtistUrl(artist.name, artist.id);
  const shareUrl = `https://rasika.life${artistUrl}`;

  const instrument = artist.instrument?.trim();
  // The one "instrument · city" line, shared with the artist card. It used to be built
  // inline here, and the city then rendered a second time in its own paragraph below —
  // so an artist with a city but no instrument saw it twice.
  const tagline = artistTagline(artist);
  const subtitle = instrument
    ? capitalize(instrument)
    : isGroup
      ? 'Performing group'
      : 'Indian classical music artist';
  // Honorific, instrument and city on one line under the name. The honorific used to sit
  // beside the portrait on its own, where "Vidhushi" read like the artist's name.
  const identityLine = [artist.title, tagline ?? subtitle].filter(Boolean).join(' · ');

  const socialLinks = artist.socialLinks ?? [];
  const specialisations = artist.specialisations ?? [];
  const gurus = (artist.gurus ?? [])
    .slice()
    .sort(
      (a, b) => (a.fromYear ?? Number.POSITIVE_INFINITY) - (b.fromYear ?? Number.POSITIVE_INFINITY)
    );
  const collaborators = (artist.collaborators ?? [])
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 12);
  // Featured photos lead the teaser, but the section shows whenever the artist has *any*
  // photo. Gating the whole block on `featured` left the "View all photos" link inside it,
  // so a moderator who uploaded a gallery and never pressed Feature — the default, since
  // addArtistPhoto stores featured: false — had a gallery page nothing on the site linked to.
  const galleryFeatured = galleryPhotos.filter(p => p.featured);
  const galleryTeaser = (galleryFeatured.length > 0 ? galleryFeatured : galleryPhotos).slice(0, 6);

  // A featured performance can also turn up in the chronological lists; drop the overlap
  // so the same concert never renders twice. An upcoming date wins the tie — "they play
  // here next week" is worth more to a reader than "this was a highlight".
  const upcomingIds = new Set(upcomingEvents.map(e => e.eventId));
  const notable = featured.filter(f => !upcomingIds.has(f.eventId));
  const notableIds = new Set(notable.map(f => f.eventId));
  const recentEvents = pastEvents.filter(e => !notableIds.has(e.eventId));
  const hasEvents = upcomingEvents.length > 0 || notable.length > 0 || recentEvents.length > 0;

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Artists', path: '/artists' },
    { label: artist.name, path: artistUrl },
  ];

  const sameAs = [...socialLinks.map(l => l.url), artist.website].filter((u): u is string => !!u);
  const awardNames = awards.map(a => a.awardName);

  // The vital-statistics block. Built as a list so an absent field simply is not there, which
  // keeps the rail looking deliberate on a sparse record rather than full of empty rows.
  const facts: Array<{ label: string; value: string }> = [];
  if (artist.birthYear) {
    facts.push({
      label: 'Born',
      value: `${artist.birthYear}${artist.birthPlace ? `, ${artist.birthPlace}` : ''}`,
    });
  }
  if (instrument) facts.push({ label: 'Discipline', value: capitalize(instrument) });
  if (artist.city) facts.push({ label: 'Based in', value: artist.city });
  if (artist.activeYears) facts.push({ label: 'Active', value: artist.activeYears });
  if (artist.practiceStartYear) {
    facts.push({ label: 'Training since', value: String(artist.practiceStartYear) });
  }
  if (artist.debutYear) facts.push({ label: 'Debut', value: String(artist.debutYear) });
  if (specialisations.length > 0) {
    facts.push({ label: 'Specialisations', value: specialisations.join(', ') });
  }

  // `gurus` is sorted oldest-first for the timeline, so the most recent is the last entry.
  const latestGuru = gurus.length > 0 ? gurus[gurus.length - 1] : undefined;
  const latestAward =
    awards.length > 0
      ? awards.reduce((latest, a) => ((a.year ?? 0) > (latest.year ?? 0) ? a : latest))
      : undefined;

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />
      {/* Photo above the name, not beside it: the portrait is the first credibility signal a
          reader gets, and tucking it next to the honorific made "Vidhushi" read like a name.
          The identity line carries honorific, instrument and city together so nothing repeats
          further down. */}
      <DetailPageHeader
        title={artist.name}
        media={
          <div className="flex items-end gap-4">
            <HeroAvatar photoUrl={artist.photoUrl} name={artist.name} />
            {artist.claimStatus === 'verified' && (
              <Badge variant="secondary" className="mb-2 gap-1">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified artist
              </Badge>
            )}
          </div>
        }
        subtitle={identityLine}
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

      {/* Two columns from lg up: prose and everything visual on the left, the factual record
          on the right. Below lg the rail stacks under the main column, so a phone reads
          biography first and reference facts after. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <div className="min-w-0">
          {/* Biography — the main crawlable block, and the reason the rail exists: the facts
              that used to crowd it now sit alongside instead of underneath. */}
          {artist.biography && (
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold">About</h2>
              <p className="max-w-prose whitespace-pre-line leading-7">{artist.biography}</p>
            </section>
          )}

          {/* The full lineage, when the rail's summary is not the whole story. */}
          {gurus.length > 1 && (
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

          {/* Likewise the honours: one is a rail fact, several are a section. */}
          {awards.length > 1 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                <Award className="h-5 w-5" />
                Awards & honours
              </h2>
              <ul className="space-y-2">
                {awards.map(award => (
                  <li key={award.awardId} className="text-sm">
                    <span className="font-medium">{award.awardName}</span>
                    {award.year ? (
                      <span className="text-muted-foreground"> · {award.year}</span>
                    ) : null}
                    {award.category ? (
                      <span className="text-muted-foreground"> · {award.category}</span>
                    ) : null}
                  </li>
                ))}
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
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {comp.count}×
                          </span>
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
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {raga.count}×
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Derived from logged concerts</p>
            </section>
          )}

          {/* Events — upcoming first, then curated highlights, then recent (§6) */}
          {hasEvents && (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold">Events</h2>

              {upcomingEvents.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Upcoming
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {upcomingEvents.map(event => (
                      <EventCard
                        key={event.eventId}
                        eventId={event.eventId}
                        eventTitle={event.eventTitle}
                        eventStartDateTime={event.eventStartDateTime}
                        role={event.role}
                        posterUrl={postersByEventId[event.eventId]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {notable.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Notable performances
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {notable.map(f => (
                      <EventCard
                        key={f.eventId}
                        eventId={f.eventId}
                        eventTitle={f.eventTitle}
                        eventStartDateTime={f.eventStartDateTime}
                        role={f.role}
                        posterUrl={postersByEventId[f.eventId]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {recentEvents.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Recent
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentEvents.map(event => (
                      <EventCard
                        key={event.eventId}
                        eventId={event.eventId}
                        eventTitle={event.eventTitle}
                        eventStartDateTime={event.eventStartDateTime}
                        role={event.role}
                        posterUrl={postersByEventId[event.eventId]}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Link to={`${artistUrl}/events`} className="mt-4 inline-block text-sm text-primary">
                View all events &rarr;
              </Link>
            </section>
          )}

          {/* Gallery teaser — featured photos first, hidden only when there are no photos at all */}
          {galleryTeaser.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold">Gallery</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {galleryTeaser.map(photo => (
                  <figure key={photo.id} className="overflow-hidden rounded-lg border">
                    {/* Empty alt when a caption is showing: the figcaption below already carries
                    that text, and repeating it in alt makes a screen reader read it twice.
                    Without a caption the image needs a description of its own. */}
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption ? '' : `${artist.name}, photograph`}
                      loading="lazy"
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
              {/* Chips, not a twelve-card grid. Every card read "1 shared event", so the
                  least informative block on the page was also the largest. The count only
                  appears once it says something a reader could not assume. */}
              <ul className="flex flex-wrap gap-2">
                {collaborators.map(c => (
                  <li key={c.artistId}>
                    <Link
                      to={generateArtistUrl(c.name, c.artistId)}
                      className="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-primary/50"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.topRoles && c.topRoles.length > 0 && (
                        <span className="text-xs text-muted-foreground">{c.topRoles[0]}</span>
                      )}
                      {c.sharedEventCount > 1 && (
                        <span className="text-xs text-muted-foreground">×{c.sharedEventCount}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* The factual record, Wikipedia-style. Vital statistics, then the single most recent
            guru and honour as a summary; the full lists live in the main column and only
            appear when there is more than one, so nothing is stated twice. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border bg-muted/40 p-5">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              At a glance
            </h2>
            <dl className="space-y-3 text-sm">
              {facts.map(fact => (
                <div key={fact.label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="mt-0.5">{fact.value}</dd>
                </div>
              ))}
              {latestGuru && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {gurus.length > 1 ? 'Most recent guru' : 'Guru'}
                  </dt>
                  <dd className="mt-0.5">
                    {latestGuru.id ? (
                      <Link
                        to={generateArtistUrl(latestGuru.name, latestGuru.id)}
                        className="font-medium hover:underline"
                      >
                        {latestGuru.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{latestGuru.name}</span>
                    )}
                    {gurus.length > 1 && (
                      <span className="text-muted-foreground"> and {gurus.length - 1} more</span>
                    )}
                  </dd>
                </div>
              )}
              {latestAward && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {awards.length > 1 ? 'Latest honour' : 'Honour'}
                  </dt>
                  <dd className="mt-0.5">
                    <span className="font-medium">{latestAward.awardName}</span>
                    {latestAward.year ? (
                      <span className="text-muted-foreground"> · {latestAward.year}</span>
                    ) : null}
                    {awards.length > 1 && (
                      <span className="text-muted-foreground"> and {awards.length - 1} more</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {(socialLinks.length > 0 || artist.website) && (
              <div className="mt-5 flex flex-col gap-2 border-t pt-4">
                {artist.website && (
                  <a
                    href={artist.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-ext-arrow inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
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
                    className="no-ext-arrow inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {SOCIAL_PLATFORM_LABELS[link.platform as keyof typeof SOCIAL_PLATFORM_LABELS] ??
                      link.platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Claim (§8) — understated and low in the reading order: it speaks to one person
              in a thousand visitors. */}
          <ClaimProfile
            artistName={artist.name}
            status={myClaimStatus}
            isLoggedIn={isLoggedIn}
            claimStatus={artist.claimStatus}
          />
        </aside>
      </div>

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
