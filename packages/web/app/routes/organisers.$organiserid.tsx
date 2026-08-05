import { SOCIAL_PLATFORM_LABELS } from '@rasika/core/domain/social-link';
import { Calendar, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { data, redirect, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData, OrganiserStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { affiliationPeriod } from '~/lib/affiliation-display';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { eventListingDescription } from '~/lib/listing-description';
import {
  generateArtistUrl,
  generateEventUrl,
  generateOrganiserUrl,
  generateVenueUrl,
  parseSlug,
} from '~/lib/url-slug';

interface OrganiserDetail {
  id: string;
  name: string;
  description?: string;
  organisationType?: string;
  city?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  website?: string;
  foundedYear?: number;
  logoUrl?: string;
  tags?: string[];
  venueId?: string;
  venueName?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
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

// One row of the ArtistAffiliation junction, read from the organisation's side.
interface AffiliatedArtist {
  artistId: string;
  artistName: string;
  role?: string;
  startYear?: number;
  endYear?: number;
  isCurrent?: boolean;
}

const ORGANISATION_TYPE_LABELS: Record<string, string> = {
  sabha: 'Sabha',
  trust: 'Trust',
  ngo: 'NGO',
  temple: 'Temple',
  university: 'University',
  other: 'Other',
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { organiserid } = params;
  if (!organiserid) {
    throw new Response('Organiser ID is required', { status: 400 });
  }

  const parsed = parseSlug(organiserid);
  if (!parsed) {
    throw new Response('Organiser not found', { status: 404 });
  }
  const { id } = parsed;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const [organiser, eventsResult, affiliatedArtists] = await Promise.all([
      serverClient.organiser.get.query({ id }),
      serverClient.event.byOrganiser.query({ organiserId: id, limit: 50 }),
      // The reverse side of the ArtistAffiliation junction: one query on the byOrganiser
      // index, not a scan. Rows are dropped when an artist is deleted, so nothing here needs
      // to filter on the artist's own deletedAt.
      serverClient.organiser.listArtists.query({ organiserId: id }),
    ]);

    if (!organiser) {
      throw new Response('Organiser not found', { status: 410 });
    }

    if (organiser.mergedIntoId) {
      const canonical = await serverClient.organiser.get.query({ id: organiser.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateOrganiserUrl(canonical.name, canonical.id), 301);
      }
    }

    return data({
      organiser,
      events: eventsResult.items,
      affiliatedArtists,
      user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.ORGANISER_NOT_FOUND) {
        throw new Response(error.message, { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Organiser not found', { status: 410 });
    }
    console.error('Failed to load organiser:', error);
    throw new Response('Failed to load organiser', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const loaded = loaderData as { organiser: OrganiserDetail; events: EventItem[] } | undefined;
  const organiser = loaded?.organiser;
  if (!organiser) {
    return [{ title: 'Organiser Not Found - Rasika.life' }];
  }

  const canonicalUrl = `https://rasika.life${generateOrganiserUrl(organiser.name, organiser.id)}`;
  const location = organiser.city || organiser.address?.city || undefined;

  // Organisers already convert far better than venues, so this is consistency
  // rather than rescue - but naming the next concert can only help.
  const description = eventListingDescription({
    name: organiser.name,
    events: loaded?.events ?? [],
    preposition: 'by',
    fallback: 'Indian classical arts performances and concerts.',
    location,
  });

  return [
    { title: `${organiser.name} - Organiser - Rasika.life` },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

function formatAddress(address: OrganiserDetail['address']): string | null {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.postalCode, address.country];
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : null;
}

export default function OrganiserDetailPage() {
  const { organiser, events, affiliatedArtists, user, isModerator } = useLoaderData<{
    organiser: OrganiserDetail;
    events: EventItem[];
    affiliatedArtists: AffiliatedArtist[];
    user: { id: string } | null;
    isModerator: boolean;
  }>();

  const shareUrl = `https://rasika.life${generateOrganiserUrl(organiser.name, organiser.id)}`;
  const typeLabel = organiser.organisationType
    ? (ORGANISATION_TYPE_LABELS[organiser.organisationType] ?? organiser.organisationType)
    : null;
  // Same split as the venue page: the list mixes past with future, and somebody
  // arriving from a search for this organiser wants the next concert first.
  const now = Date.now();
  const upcomingEvents = events
    .filter(e => new Date(e.startDateTime).getTime() >= now)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  const pastEvents = events
    .filter(e => new Date(e.startDateTime).getTime() < now)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  const addressStr = formatAddress(organiser.address);
  const locationStr = organiser.city || organiser.address?.city || null;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: organiser.name, path: '#' },
        ]}
      />

      {/* Header with logo */}
      <div className="flex items-start gap-5 mb-2">
        {organiser.logoUrl && (
          <img
            src={organiser.logoUrl}
            alt={organiser.name}
            className="w-20 h-20 rounded-lg object-cover border bg-muted shrink-0 mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <DetailPageHeader
            title={organiser.name}
            subtitle="Event Organiser"
            shareUrl={shareUrl}
            shareTitle={`${organiser.name} - Rasika.life`}
            shareDescription={`Events organised by ${organiser.name}`}
            editUrl={
              user ? `${generateOrganiserUrl(organiser.name, organiser.id)}/edit` : undefined
            }
            isModerator={isModerator}
            mergeUrl={`/moderator/merge?entityType=organiser&entityId=${organiser.id}`}
            requestDeletionUrl={`/moderator/request-deletion?entityType=organiser&entityId=${organiser.id}`}
          />
        </div>
      </div>

      {/* Type badge */}
      {typeLabel && (
        <div className="mb-4">
          <Badge variant="outline">{typeLabel}</Badge>
        </div>
      )}

      {/* Quick info */}
      <div className="space-y-2 mb-8">
        {(locationStr || addressStr) && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-sm">{addressStr ?? locationStr}</span>
          </div>
        )}

        {organiser.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 text-primary shrink-0" />
            <a
              href={`tel:${organiser.phone}`}
              className="text-sm hover:text-foreground transition-colors"
            >
              {organiser.phone}
            </a>
          </div>
        )}

        {organiser.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <a
              href={`mailto:${organiser.email}`}
              className="text-sm hover:text-foreground transition-colors"
            >
              {organiser.email}
            </a>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {organiser.website && (
            <a
              href={organiser.website}
              target="_blank"
              rel="noopener noreferrer"
              className="no-ext-arrow inline-flex items-center gap-1 text-primary text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              Website
            </a>
          )}
          {organiser.foundedYear && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Est. {organiser.foundedYear}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {organiser.description && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {organiser.description}
          </p>
        </section>
      )}

      {/* Primary venue */}
      {organiser.venueName && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Primary Venue</h2>
          {organiser.venueId ? (
            <Link
              to={generateVenueUrl(organiser.venueName, organiser.venueId)}
              className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {organiser.venueName}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">{organiser.venueName}</p>
          )}
        </section>
      )}

      {/* Tags */}
      {organiser.tags && organiser.tags.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Focus Areas</h2>
          <div className="flex flex-wrap gap-2">
            {organiser.tags.map(tag => (
              <Badge key={tag} variant="secondary">
                {tag.replace(/-/g, ' ')}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Social links */}
      {organiser.socialLinks && organiser.socialLinks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Social Links</h2>
          <div className="flex flex-wrap gap-3">
            {organiser.socialLinks.map(link => (
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

      {/* Only renders once someone is affiliated, so an organiser with no faculty does not
          gain an empty heading. This is the payoff for making affiliations a junction: the
          same rows that show "faculty at IIM Bangalore" on an artist page produce this list
          from one query on the reverse index. */}
      {affiliatedArtists.length > 0 && (
        <section className="mt-6">
          <h2 className="section-heading mb-6">Artists</h2>
          <ul className="flex flex-wrap gap-2">
            {affiliatedArtists.map(affiliation => {
              const period = affiliationPeriod(affiliation);
              return (
                <li key={affiliation.artistId}>
                  <Link
                    to={generateArtistUrl(affiliation.artistName, affiliation.artistId)}
                    className="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-primary/50"
                  >
                    <span className="font-medium">{affiliation.artistName}</span>
                    {affiliation.role && (
                      <span className="text-xs text-muted-foreground">{affiliation.role}</span>
                    )}
                    {period && <span className="text-xs text-muted-foreground">{period}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="section-heading mb-6">Events</h2>

        {events.length === 0 ? (
          <EmptyState message="No events by this organiser yet." />
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
            {pastEvents.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8 mb-4 text-muted-foreground">
                  Past events
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {pastEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Organisers', item: 'https://rasika.life/organisers' },
          {
            name: organiser.name,
            item: `https://rasika.life${generateOrganiserUrl(organiser.name, organiser.id)}`,
          },
        ]}
      />
      <OrganiserStructuredData
        organiser={{
          ...organiser,
          url: shareUrl,
          venue: organiser.venueName
            ? {
                name: organiser.venueName,
                url: organiser.venueId
                  ? `https://rasika.life${generateVenueUrl(organiser.venueName, organiser.venueId)}`
                  : undefined,
              }
            : null,
          // Upcoming only, for the same reason as the venue page.
          events: upcomingEvents.slice(0, 20).map(event => ({
            title: event.title,
            url: `https://rasika.life${generateEventUrl(event.title, event.id)}`,
            startDateTime: event.startDateTime,
            endDateTime: event.endDateTime,
            venueName: event.venueName,
          })),
        }}
      />
    </main>
  );
}
