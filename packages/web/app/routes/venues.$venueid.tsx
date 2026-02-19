import { ExternalLink, MapPin, Pencil } from 'lucide-react';
import { data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EventCard } from '~/components/EventCard';
import { EmptyState } from '~/components/shared/EmptyState';
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

export const loader: LoaderFunction = async ({ request, params }) => {
  const { venueid } = params;
  if (!venueid) {
    throw new Response('Venue ID is required', { status: 400 });
  }

  const parsed = parseSlug(venueid);
  const id = parsed ? parsed.id : venueid;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const [venue, eventsResult] = await Promise.all([
      serverClient.venue.get.query({ id }),
      serverClient.event.byVenue.query({ venueId: id, limit: 50 }),
    ]);

    if (!venue) {
      throw new Response('Venue not found', { status: 404 });
    }

    return data({ venue, events: eventsResult.items, user });
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
  const { venue, events, user } = useLoaderData<{
    venue: VenueDetail;
    events: EventItem[];
    user: { id: string } | null;
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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{venue.name}</h1>
          {user && (
            <a
              href={`${generateVenueUrl(venue.name, venue.id)}/edit`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </a>
          )}
        </div>

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
    </main>
  );
}
