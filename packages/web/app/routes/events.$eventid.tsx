import {
  Calendar,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Merge,
  Pencil,
  Phone,
  Ticket,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Link, data, redirect, useLoaderData } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EventStructuredData } from '~/components/structured-data';
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
  const id = parsed ? parsed.id : eventid;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const event = await serverClient.event.get.query({ id });

    if (event?.mergedIntoId) {
      const canonical = await serverClient.event.get.query({ id: event.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateEventUrl(canonical.title, canonical.id), 301);
      }
    }

    // Fetch festival poster as fallback if the event has no poster
    let festivalPosterUrl: string | undefined;
    if (event?.festivalId && !event?.posterUrl) {
      try {
        const festival = await serverClient.festival.get.query({ id: event.festivalId });
        festivalPosterUrl = festival?.posterUrl;
      } catch {
        // Festival fetch failure is non-fatal
      }
    }

    return data({
      event,
      user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
      festivalPosterUrl,
    });
  } catch (error) {
    console.error('Failed to load event:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.EVENT_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Event not found', { status: 404 });
    }
    throw new Response('Failed to load event', { status: 500 });
  }
};

export const action: ActionFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) {
    return data({ error: 'Event ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(eventid);
  const id = parsed ? parsed.id : eventid;

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

  return [
    { title: `${event.title} - ${dateStr} - Rasika.life` },
    { name: 'description', content: desc },
    { property: 'og:title', content: `${event.title} - ${dateStr}` },
    { property: 'og:description', content: desc },
    { property: 'og:type', content: 'website' },
    ...(event.posterUrl ? [{ property: 'og:image', content: event.posterUrl }] : []),
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
  const { event, user, isModerator, festivalPosterUrl } = useLoaderData<{
    event: EventDetail;
    user: { id: string } | null;
    isModerator: boolean;
    festivalPosterUrl?: string;
  }>();

  const startDate = new Date(event.startDateTime);
  const endDate = event.endDateTime ? new Date(event.endDateTime) : null;
  const displayPosterUrl = event.posterUrl || festivalPosterUrl;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: event.title, path: '#' },
        ]}
      />

      <div className="mt-6 grid md:grid-cols-[300px_1fr] gap-8">
        {/* Poster */}
        {(displayPosterUrl || isModerator) && (
          <div>
            {displayPosterUrl && (
              <img
                src={displayPosterUrl}
                alt={`${event.title} poster`}
                className="w-full rounded-lg shadow-md"
              />
            )}
            {isModerator && <PosterUploader />}
          </div>
        )}

        {/* Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold">{event.title}</h1>
              <div className="flex items-center gap-2 shrink-0 mt-2">
                {user && event.status === 'approved' && (
                  <a
                    href={`${generateEventUrl(event.title, event.id)}/edit`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </a>
                )}
                {isModerator && (
                  <a
                    href={`/moderator/merge?entityType=event&entityId=${event.id}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Merge className="h-4 w-4" />
                    Merge
                  </a>
                )}
                {isModerator && (
                  <a
                    href={`/moderator/request-deletion?entityType=event&entityId=${event.id}`}
                    className="inline-flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </a>
                )}
              </div>
            </div>
            {event.festivalName && (
              <p className="text-lg text-muted-foreground mt-1">
                Part of{' '}
                {event.festivalId ? (
                  <Link
                    to={generateFestivalUrl(event.festivalName, event.festivalId)}
                    className="text-primary"
                  >
                    {event.festivalName}
                  </Link>
                ) : (
                  event.festivalName
                )}
              </p>
            )}
          </div>

          {event.description && <p className="text-muted-foreground">{event.description}</p>}

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

      {/* Artists */}
      {event.artists && event.artists.length > 0 && (
        <section className="mt-8">
          <h2 className="section-heading mb-4">Artists</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {event.artists.map(artist => (
              <Card key={`${artist.name}-${artist.role || 'artist'}`}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {artist.title ? `${artist.title} ` : ''}
                      {artist.id ? (
                        <Link
                          to={generateArtistUrl(artist.name, artist.id)}
                          className="text-primary"
                        >
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
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Ticketing */}
      {event.ticketing && (
        <section className="mt-8">
          <h2 className="section-heading mb-4">Ticketing</h2>
          <Card>
            <CardContent className="py-4 space-y-2">
              {event.ticketing.url && (
                <a
                  href={event.ticketing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary"
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
        <section className="mt-8">
          <h2 className="section-heading mb-4">Contact</h2>
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
                  className="flex items-center gap-2 text-sm"
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
        <section className="mt-8">
          <h2 className="section-heading mb-4">Organised by</h2>
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
        <section className="mt-8">
          <h2 className="section-heading mb-4">Sponsors</h2>
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

      <EventStructuredData
        event={{
          title: event.title,
          description: event.description,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          venueName: event.venueName,
          organiserName: event.organiserName,
          posterUrl: event.posterUrl,
          entryType: event.entryType,
          artists: event.artists,
          url: `https://rasika.life${generateEventUrl(event.title, event.id)}`,
        }}
      />
    </main>
  );
}
