import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Ticket,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Link, data, redirect, useLoaderData } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { PosterImage } from '~/components/PosterImage';
import { BreadcrumbStructuredData, EventStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import {
  generateArtistUrl,
  generateEventUrl,
  generateFestivalUrl,
  generateOrganiserUrl,
  generateVenueUrl,
  parseSlug,
} from '~/lib/url-slug';

interface FestivalEventItem {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  artists?: Array<{ name: string; role?: string }>;
}

interface EventDetail {
  id: string;
  title: string;
  status?: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  venueId?: string;
  organiserName?: string;
  organiserId?: string;
  festivalName?: string;
  festivalId?: string;
  artists?: Array<{ id?: string; title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
  posterUrl?: string;
  ticketing?: {
    url?: string;
    prices?: Record<string, number>;
    contactPhone?: string;
    contactEmail?: string;
    partnerName?: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
    socialHandles?: string[];
  };
  sponsors?: Array<{ name: string; type?: string }>;
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) {
    throw new Response('Event ID is required', { status: 400 });
  }

  const parsed = parseSlug(eventid);
  if (!parsed) {
    throw new Response('Event not found', { status: 410 });
  }
  const { id } = parsed;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const event = await serverClient.event.get.query({ id });

    if (!event) {
      throw new Response('Event not found', { status: 410 });
    }

    if (event.mergedIntoId) {
      const canonical = await serverClient.event.get.query({ id: event.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateEventUrl(canonical.title, canonical.id), 301);
      }
    }

    // Fetch festival poster as fallback if the event has no poster
    let festivalPosterUrl: string | undefined;
    let festivalEvents: FestivalEventItem[] = [];
    let prevEvent: FestivalEventItem | null = null;
    let nextEvent: FestivalEventItem | null = null;

    if (event?.festivalId) {
      try {
        const [festival, festivalEventsResult] = await Promise.all([
          event.posterUrl
            ? Promise.resolve(null)
            : serverClient.festival.get.query({ id: event.festivalId }),
          serverClient.event.byFestival.query({ festivalId: event.festivalId, limit: 100 }),
        ]);
        festivalPosterUrl = festival?.posterUrl;
        festivalEvents = (festivalEventsResult.items || []) as FestivalEventItem[];

        const sorted = [...festivalEvents].sort(
          (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        );
        const idx = sorted.findIndex(e => e.id === event.id);
        prevEvent = idx > 0 ? sorted[idx - 1] : null;
        nextEvent = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
        festivalEvents = sorted;
      } catch {
        // Festival fetch failure is non-fatal
      }
    }

    let venueMapLink: string | undefined;
    let venueAddress: string | undefined;
    if (event.venueId) {
      try {
        const venue = await serverClient.venue.get.query({ id: event.venueId });
        venueMapLink = venue?.mapLink;
        if (venue?.address) {
          const parts = [
            venue.address.street,
            venue.address.city,
            venue.address.state,
            venue.address.country,
          ].filter(Boolean);
          if (parts.length > 0) venueAddress = parts.join(', ');
        }
      } catch {
        // Non-fatal
      }
    }

    return data({
      event,
      user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
      festivalPosterUrl,
      festivalEvents,
      prevEvent,
      nextEvent,
      venueMapLink,
      venueAddress,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.EVENT_NOT_FOUND) {
        throw new Response(error.message, { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Event not found', { status: 410 });
    }
    console.error(`Failed to load event [id=${id}]:`, error);
    throw new Response('Failed to load event', { status: 500 });
  }
};

export const action: ActionFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) {
    return data({ error: 'Event ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(eventid);
  if (!parsed) {
    throw new Response('Event not found', { status: 410 });
  }
  const { id } = parsed;

  const user = await getUser(request);
  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'updatePoster') {
    const posterUrl = formData.get('posterUrl') as string;
    const posterUploadId = formData.get('posterUploadId') as string;

    if (!posterUrl || !posterUploadId) {
      return data({ error: 'Missing poster data' }, { status: 400 });
    }

    try {
      const serverClient = await createServerClient(request);
      await serverClient.event.updatePoster.mutate({ id, posterUrl, posterUploadId });
      return data({ success: true });
    } catch (error) {
      console.error('Failed to update poster:', error);
      return data({ error: 'Failed to update poster' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const event = (loaderData as { event: EventDetail } | undefined)?.event;
  if (!event) {
    return [{ title: 'Event Not Found - Rasika.life' }];
  }

  const dateStr = new Date(event.startDateTime).toLocaleDateString('en-IN', {
    dateStyle: 'long',
  });

  const desc =
    event.description ||
    `${event.title} on ${dateStr}${event.venueName ? ` at ${event.venueName}` : ''}`;

  const canonicalUrl = `https://rasika.life${generateEventUrl(event.title, event.id)}`;
  return [
    { title: `${event.title} - ${dateStr} - Rasika.life` },
    { name: 'description', content: desc },
    { property: 'og:title', content: `${event.title} - ${dateStr}` },
    { property: 'og:description', content: desc },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: event.posterUrl || 'https://rasika.life/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `${event.title} - ${dateStr}` },
    { name: 'twitter:description', content: desc },
    { name: 'twitter:image', content: event.posterUrl || 'https://rasika.life/og-image.png' },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

function PosterUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading');
    setError(null);

    try {
      const urlRes = await fetch('/events/new/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          intent: 'getUploadUrl',
          fileName: file.name,
          contentType: file.type,
        }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, posterUrl, posterUploadId } = await urlRes.json();

      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!s3Res.ok) throw new Error('Failed to upload image');

      const updateForm = new FormData();
      updateForm.append('intent', 'updatePoster');
      updateForm.append('posterUrl', posterUrl);
      updateForm.append('posterUploadId', posterUploadId);

      const updateRes = await fetch(window.location.href, {
        method: 'POST',
        body: updateForm,
        credentials: 'include',
      });
      if (!updateRes.ok) throw new Error('Failed to update poster');

      window.location.reload();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 mt-4">
      <h3 className="text-sm font-semibold">Replace Poster</h3>
      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
        className="text-sm w-full"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleUpload}
        disabled={!file || status === 'uploading'}
      >
        <Upload className="h-4 w-4 mr-2" />
        {status === 'uploading' ? 'Uploading...' : 'Replace Poster'}
      </Button>
    </div>
  );
}

export default function EventDetail() {
  const {
    event,
    user,
    isModerator,
    festivalPosterUrl,
    festivalEvents,
    prevEvent,
    nextEvent,
    venueMapLink,
    venueAddress,
  } = useLoaderData<{
    event: EventDetail;
    user: { id: string } | null;
    isModerator: boolean;
    festivalPosterUrl?: string;
    festivalEvents: FestivalEventItem[];
    prevEvent: FestivalEventItem | null;
    nextEvent: FestivalEventItem | null;
    venueMapLink?: string;
    venueAddress?: string;
  }>();

  const startDate = new Date(event.startDateTime);
  const endDate = event.endDateTime ? new Date(event.endDateTime) : null;
  const displayPosterUrl = event.posterUrl || festivalPosterUrl;
  const shareUrl = `https://rasika.life${generateEventUrl(event.title, event.id)}`;
  const dateStr = startDate.toLocaleDateString('en-IN', { dateStyle: 'long' });

  const venueQueryStr = [event.venueName, venueAddress].filter(Boolean).join(', ');
  const mapsUrl =
    venueMapLink ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQueryStr)}`;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: event.title, path: '#' },
        ]}
      />

      {(prevEvent || nextEvent) && (
        <div className="flex items-center justify-between mb-4 gap-2">
          {prevEvent ? (
            <Link
              to={generateEventUrl(prevEvent.title, prevEvent.id)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary min-w-0 max-w-[45%]"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{prevEvent.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextEvent ? (
            <Link
              to={generateEventUrl(nextEvent.title, nextEvent.id)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary min-w-0 max-w-[45%] text-right"
            >
              <span className="truncate">{nextEvent.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}

      <DetailPageHeader
        title={event.title}
        subtitle={event.festivalName ? `Part of ${event.festivalName}` : dateStr}
        shareUrl={shareUrl}
        shareTitle={event.title}
        shareDescription={`${event.title} on ${dateStr}${event.venueName ? ` at ${event.venueName}` : ''}`}
        editUrl={
          user && event.status === 'approved'
            ? `${generateEventUrl(event.title, event.id)}/edit`
            : undefined
        }
        isModerator={isModerator}
        mergeUrl={`/moderator/merge?entityType=event&entityId=${event.id}`}
        requestDeletionUrl={`/moderator/request-deletion?entityType=event&entityId=${event.id}`}
      />

      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        {/* Poster */}
        {(displayPosterUrl || isModerator) && (
          <div>
            {displayPosterUrl && (
              <PosterImage
                posterUrl={displayPosterUrl}
                alt={`${event.title} poster`}
                className="w-full rounded-lg shadow-md"
                loading="eager"
                width={300}
                height={400}
              />
            )}
            {isModerator && <PosterUploader />}
          </div>
        )}

        {/* Details */}
        <div className="space-y-4">
          {event.description && <p className="text-muted-foreground">{event.description}</p>}

          {/* Artists */}
          {event.artists && event.artists.length > 0 && (
            <div className="space-y-1">
              {event.artists.map(artist => (
                <div key={`${artist.name}-${artist.role || 'artist'}`}>
                  <p className="font-medium">
                    {artist.title ? `${artist.title} ` : ''}
                    {artist.id ? (
                      <Link to={generateArtistUrl(artist.name, artist.id)} className="text-primary">
                        {artist.name}
                      </Link>
                    ) : (
                      artist.name
                    )}
                  </p>
                  {artist.role && (
                    <p className="text-sm text-muted-foreground capitalize">{artist.role}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">
                {startDate.toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {startDate.toLocaleTimeString('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {endDate &&
                  ` - ${endDate.toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`}
              </p>
            </div>
          </div>

          {/* Venue */}
          {event.venueName && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {event.venueId ? (
                  <Link
                    to={generateVenueUrl(event.venueName, event.venueId)}
                    className="text-primary font-medium"
                  >
                    {event.venueName}
                  </Link>
                ) : (
                  <span className="font-medium">{event.venueName}</span>
                )}
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="no-ext-arrow pl-7 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Maps
              </a>
            </div>
          )}

          {/* Entry Type */}
          {event.entryType && (
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="capitalize">
                {event.entryType}
              </Badge>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {event.tags.map(tag => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticketing */}
      {event.ticketing && (
        <section className="mt-6">
          <h2 className="text-base font-semibold mb-2">Ticketing</h2>
          <Card>
            <CardContent className="py-4 space-y-2">
              {event.ticketing.url && (
                <a
                  href={
                    event.ticketing.url.startsWith('http')
                      ? event.ticketing.url
                      : `https://${event.ticketing.url}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-ext-arrow flex items-center gap-2 text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  Book Tickets
                </a>
              )}
              {event.ticketing.prices &&
                Object.entries(event.ticketing.prices).map(([category, price]) => (
                  <div key={category} className="flex justify-between text-sm">
                    <span className="capitalize">{category}</span>
                    <span className="font-medium">{price}</span>
                  </div>
                ))}
              {event.ticketing.partnerName && (
                <p className="text-sm text-muted-foreground">via {event.ticketing.partnerName}</p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Contact Info */}
      {event.contactInfo && (
        <section className="mt-6">
          <h2 className="text-base font-semibold mb-2">Contact</h2>
          <Card>
            <CardContent className="py-4 space-y-2">
              {event.contactInfo.phone && (
                <a
                  href={`tel:${event.contactInfo.phone}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Phone className="h-4 w-4" />
                  {event.contactInfo.phone}
                </a>
              )}
              {event.contactInfo.email && (
                <a
                  href={`mailto:${event.contactInfo.email}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Mail className="h-4 w-4" />
                  {event.contactInfo.email}
                </a>
              )}
              {event.contactInfo.website && (
                <a
                  href={event.contactInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-ext-arrow flex items-center gap-2 text-sm"
                >
                  <Globe className="h-4 w-4" />
                  {event.contactInfo.website}
                </a>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Organiser */}
      {event.organiserName && (
        <section className="mt-6">
          <h2 className="text-base font-semibold mb-1">Organised by</h2>
          <p className="font-medium">
            {event.organiserId ? (
              <Link
                to={generateOrganiserUrl(event.organiserName, event.organiserId)}
                className="text-primary"
              >
                {event.organiserName}
              </Link>
            ) : (
              event.organiserName
            )}
          </p>
        </section>
      )}

      {/* Sponsors */}
      {event.sponsors && event.sponsors.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-semibold mb-2">Sponsors</h2>
          <div className="flex gap-2 flex-wrap">
            {event.sponsors.map(sponsor => (
              <Badge key={sponsor.name} variant="outline">
                {sponsor.name}
                {sponsor.type && ` (${sponsor.type})`}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Festival Schedule */}
      {festivalEvents.length > 1 && event.festivalId && event.festivalName && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Festival Schedule</h2>
            <Link
              to={generateFestivalUrl(event.festivalName, event.festivalId)}
              className="text-sm text-primary"
            >
              View festival
            </Link>
          </div>
          <div className="space-y-1">
            {festivalEvents.map(fe => {
              const isCurrent = fe.id === event.id;
              const feDate = new Date(fe.startDateTime);
              return (
                <Link
                  key={fe.id}
                  to={generateEventUrl(fe.title, fe.id)}
                  className={`grid grid-cols-[auto_1fr] gap-x-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isCurrent
                      ? 'bg-primary/10 text-primary font-medium pointer-events-none'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <span className="text-muted-foreground text-xs whitespace-nowrap self-start pt-0.5">
                    {feDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {', '}
                    {feDate.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span className="truncate">{fe.title}</span>
                  {fe.artists && fe.artists.length > 0 && (
                    <>
                      <span />
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {fe.artists.map(a => a.name).join(', ')}
                      </p>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Events', item: 'https://rasika.life/events' },
          {
            name: event.title,
            item: `https://rasika.life${generateEventUrl(event.title, event.id)}`,
          },
        ]}
      />
      <EventStructuredData
        event={{
          title: event.title,
          description: event.description,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          venueName: event.venueName,
          organiserName: event.organiserName,
          organiserUrl:
            event.organiserName && event.organiserId
              ? `https://rasika.life${generateOrganiserUrl(event.organiserName, event.organiserId)}`
              : undefined,
          posterUrl: event.posterUrl,
          entryType: event.entryType,
          artists: event.artists,
          url: `https://rasika.life${generateEventUrl(event.title, event.id)}`,
          ticketing: event.ticketing
            ? { url: event.ticketing.url, prices: event.ticketing.prices }
            : undefined,
        }}
      />
    </main>
  );
}
