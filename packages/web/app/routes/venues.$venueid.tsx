import { SOCIAL_PLATFORM_LABELS } from '@rasika/core/domain/social-link';
import {
  Building2,
  Calendar,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Train,
  Users,
} from 'lucide-react';
import { data, redirect, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateVenueUrl, parseSlug } from '~/lib/url-slug';

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
  description?: string;
  venueType?: string;
  capacity?: number;
  foundedYear?: number;
  phone?: string;
  email?: string;
  website?: string;
  photoUrl?: string;
  amenities?: string[];
  nearestTransit?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
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

const VENUE_TYPE_LABELS: Record<string, string> = {
  auditorium: 'Auditorium',
  'sabha-hall': 'Sabha Hall',
  'temple-hall': 'Temple Hall',
  'open-air': 'Open Air',
  pandal: 'Pandal',
  terrace: 'Terrace',
  'community-hall': 'Community Hall',
  'heritage-building': 'Heritage Building',
  university: 'University',
  other: 'Other',
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { venueid } = params;
  if (!venueid) {
    throw new Response('Venue ID is required', { status: 400 });
  }

  const parsed = parseSlug(venueid);
  if (!parsed) {
    throw new Response('Venue not found', { status: 404 });
  }
  const { id } = parsed;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const [venue, eventsResult] = await Promise.all([
      serverClient.venue.get.query({ id }),
      serverClient.event.byVenue.query({ venueId: id, limit: 50 }),
    ]);

    if (!venue) {
      throw new Response('Venue not found', { status: 410 });
    }

    if (venue.mergedIntoId) {
      const canonical = await serverClient.venue.get.query({ id: venue.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateVenueUrl(canonical.name, canonical.id), 301);
      }
    }

    return data({
      venue,
      events: eventsResult.items,
      user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.VENUE_NOT_FOUND) {
        throw new Response(error.message, { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Venue not found', { status: 410 });
    }
    console.error('Failed to load venue:', error);
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
  const canonicalUrl = `https://rasika.life${generateVenueUrl(venue.name, venue.id)}`;

  return [
    { title: `${venue.name} - Venue - Rasika.life` },
    {
      name: 'description',
      content: `Events and performances at ${venue.name}${locationStr}. Indian classical arts venue.`,
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

function formatAddress(address: VenueDetail['address']): string | null {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.postalCode, address.country];
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : null;
}

export default function VenueDetailPage() {
  const { venue, events, user, isModerator } = useLoaderData<{
    venue: VenueDetail;
    events: EventItem[];
    user: { id: string } | null;
    isModerator: boolean;
  }>();

  const addressStr = formatAddress(venue.address);
  const shareUrl = `https://rasika.life${generateVenueUrl(venue.name, venue.id)}`;
  const venueTypeLabel = venue.venueType ? (VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType) : null;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: venue.name, path: '#' },
        ]}
      />

      {/* Hero photo */}
      {venue.photoUrl && (
        <div className="mb-6 rounded-xl overflow-hidden bg-muted">
          <img
            src={venue.photoUrl}
            alt={venue.name}
            className="w-full max-h-64 object-cover"
          />
        </div>
      )}

      <DetailPageHeader
        title={venue.name}
        subtitle="Venue"
        shareUrl={shareUrl}
        shareTitle={`${venue.name} - Rasika.life`}
        shareDescription={`Events and performances at ${venue.name}`}
        editUrl={user ? `${generateVenueUrl(venue.name, venue.id)}/edit` : undefined}
        isModerator={isModerator}
        mergeUrl={`/moderator/merge?entityType=venue&entityId=${venue.id}`}
        requestDeletionUrl={`/moderator/request-deletion?entityType=venue&entityId=${venue.id}`}
      />

      {/* Type badge */}
      {venueTypeLabel && (
        <div className="-mt-6 mb-4">
          <Badge variant="outline">{venueTypeLabel}</Badge>
        </div>
      )}

      {/* Quick info row */}
      <div className="space-y-2 mb-8">
        {addressStr && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-sm">{addressStr}</span>
          </div>
        )}

        {venue.nearestTransit && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Train className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-sm">{venue.nearestTransit}</span>
          </div>
        )}

        {venue.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 text-primary shrink-0" />
            <a href={`tel:${venue.phone}`} className="text-sm hover:text-foreground transition-colors">
              {venue.phone}
            </a>
          </div>
        )}

        {venue.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <a href={`mailto:${venue.email}`} className="text-sm hover:text-foreground transition-colors">
              {venue.email}
            </a>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              Website
            </a>
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
      </div>

      {/* Key facts */}
      {(venue.capacity || venue.foundedYear) && (
        <div className="flex flex-wrap gap-4 mb-8">
          {venue.capacity && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Capacity:</span>
              <span className="font-medium">{venue.capacity.toLocaleString()}</span>
            </div>
          )}
          {venue.foundedYear && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Est.</span>
              <span className="font-medium">{venue.foundedYear}</span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {venue.description && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {venue.description}
          </p>
        </section>
      )}

      {/* Amenities */}
      {venue.amenities && venue.amenities.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Amenities
          </h2>
          <div className="flex flex-wrap gap-2">
            {venue.amenities.map((amenity) => (
              <Badge key={amenity} variant="secondary">
                {amenity.replace(/-/g, ' ')}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Social links */}
      {venue.socialLinks && venue.socialLinks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Social Links</h2>
          <div className="flex flex-wrap gap-3">
            {venue.socialLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {SOCIAL_PLATFORM_LABELS[link.platform as keyof typeof SOCIAL_PLATFORM_LABELS] ?? link.platform}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="section-heading mb-6">Events at this venue</h2>

        {events.length === 0 ? (
          <EmptyState message="No upcoming events at this venue." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events
              .sort(
                (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
              )
              .map(event => (
                <EventCard key={event.id} event={event} />
              ))}
          </div>
        )}
      </section>

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Venues', item: 'https://rasika.life/venues' },
          {
            name: venue.name,
            item: `https://rasika.life${generateVenueUrl(venue.name, venue.id)}`,
          },
        ]}
      />
    </main>
  );
}
