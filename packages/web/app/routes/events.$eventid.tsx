import {
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Ticket,
  Upload,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, data, redirect, useFetcher, useLoaderData } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EventCard } from '~/components/EventCard';
import { PosterImage } from '~/components/PosterImage';
import { BreadcrumbStructuredData, EventStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import {
  type ContactDetails,
  type ResolvedEventContact,
  resolveEventContact,
} from '~/lib/event-contact';
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

interface RelatedEventItem {
  id: string;
  title: string;
  startDateTime: string;
  venueName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  entryType?: string;
  posterUrl?: string;
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
  posterOgUrl?: string;
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

    // Most posters print no contact details at all, so the section used to be missing from the
    // majority of event pages. The organiser record usually knows. Only fetched when the event
    // itself states nothing — `resolveEventContact` would ignore the result otherwise, and this
    // is a public read path.
    let organiserContact: ContactDetails | undefined;
    if (event.organiserId && !resolveEventContact(event.contactInfo, undefined)) {
      try {
        const organiser = await serverClient.organiser.get.query({ id: event.organiserId });
        if (organiser) {
          organiserContact = {
            phone: organiser.phone,
            email: organiser.email,
            website: organiser.website,
          };
        }
      } catch {
        // Non-fatal, same as the venue lookup above.
      }
    }

    const eventEndTime = event.endDateTime
      ? new Date(event.endDateTime)
      : new Date(new Date(event.startDateTime).getTime() + 4 * 60 * 60 * 1000);
    const isPast = eventEndTime < new Date();

    const [venueEventsResult, organiserEventsResult, rsvpInfo, concertLog, setlistData] =
      await Promise.all([
        event.venueId
          ? serverClient.event.byVenue.query({ venueId: event.venueId, limit: 6 })
          : Promise.resolve({ items: [] }),
        event.organiserId
          ? serverClient.event.byOrganiser.query({ organiserId: event.organiserId, limit: 6 })
          : Promise.resolve({ items: [] }),
        serverClient.rsvp.getForEvent.query({ eventId: id }),
        isPast && user ? serverClient.concertLog.get.query({ eventId: id }) : Promise.resolve(null),
        isPast
          ? serverClient.eventSetlist.getForEvent.query({ eventId: id })
          : Promise.resolve({ canonical: [], userOwn: null }),
      ]);

    const relatedVenueEvents = (venueEventsResult.items as RelatedEventItem[])
      .filter(e => e.id !== id)
      .slice(0, 5);
    const relatedOrganiserEvents = (organiserEventsResult.items as RelatedEventItem[])
      .filter(e => e.id !== id)
      .slice(0, 5);

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
      contact: resolveEventContact(event.contactInfo, organiserContact),
      relatedVenueEvents,
      relatedOrganiserEvents,
      rsvpCount: rsvpInfo.count,
      userIsGoing: rsvpInfo.isGoing,
      isPast,
      userAttended: !!concertLog,
      attendedCount: event.attendedCount ?? 0,
      setlistCanonical: setlistData.canonical,
      setlistUserOwn: setlistData.userOwn,
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
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'toggleRsvp') {
    if (!user) {
      return data({ error: 'Sign in to RSVP' }, { status: 401 });
    }
    const serverClient = await createServerClient(request);
    const result = await serverClient.rsvp.toggle.mutate({ eventId: id });
    return data({ rsvp: result });
  }

  if (intent === 'toggleAttended') {
    if (!user) {
      return data({ error: 'Sign in to log attendance' }, { status: 401 });
    }
    const serverClient = await createServerClient(request);
    const existing = await serverClient.concertLog.get.query({ eventId: id });
    if (existing) {
      await serverClient.concertLog.delete.mutate({ eventId: id });
      const attendedCount = await serverClient.concertLog.countForEvent.query({ eventId: id });
      return data({ attended: { isAttended: false, count: attendedCount } });
    }
    await serverClient.concertLog.upsert.mutate({ eventId: id });
    const attendedCount = await serverClient.concertLog.countForEvent.query({ eventId: id });
    return data({ attended: { isAttended: true, count: attendedCount } });
  }

  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  if (intent === 'updatePoster') {
    const posterUrl = formData.get('posterUrl') as string;
    const posterUploadId = formData.get('posterUploadId') as string;
    const posterOgUrl = formData.get('posterOgUrl') as string | null;

    if (!posterUrl || !posterUploadId) {
      return data({ error: 'Missing poster data' }, { status: 400 });
    }

    try {
      const serverClient = await createServerClient(request);
      await serverClient.event.updatePoster.mutate({
        id,
        posterUrl,
        posterUploadId,
        ...(posterOgUrl ? { posterOgUrl } : {}),
      });
      return data({ success: true });
    } catch (error) {
      console.error('Failed to update poster:', error);
      return data({ error: 'Failed to update poster' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const ld = loaderData as { event: EventDetail; festivalPosterUrl?: string } | undefined;
  const event = ld?.event;
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

  // Prefer the pre-generated 1200x630 landscape crop (posterOgUrl, created by image-processor).
  // Fall back to the original poster (may be portrait but better than nothing) or the generic image.
  const ogImage =
    event.posterOgUrl ||
    event.posterUrl ||
    ld?.festivalPosterUrl ||
    'https://rasika.life/og-image.png';

  return [
    { title: `${event.title} - ${dateStr} - Rasika.life` },
    { name: 'description', content: desc },
    { property: 'og:title', content: `${event.title} - ${dateStr}` },
    { property: 'og:description', content: desc },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: ogImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/jpeg' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `${event.title} - ${dateStr}` },
    { name: 'twitter:description', content: desc },
    { name: 'twitter:image', content: ogImage },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

function toCalendarDate(iso: string): string {
  return iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildGoogleCalendarUrl(
  event: EventDetail,
  venueAddress: string | undefined,
  shareUrl: string
): string {
  const start = toCalendarDate(event.startDateTime);
  const end = event.endDateTime
    ? toCalendarDate(event.endDateTime)
    : toCalendarDate(
        new Date(new Date(event.startDateTime).getTime() + 2 * 60 * 60 * 1000).toISOString()
      );

  const location = [event.venueName, venueAddress].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: (event.description ?? '') + (shareUrl ? `\n\n${shareUrl}` : ''),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadICS(event: EventDetail, venueAddress: string | undefined, shareUrl: string): void {
  const start = toCalendarDate(event.startDateTime);
  const end = event.endDateTime
    ? toCalendarDate(event.endDateTime)
    : toCalendarDate(
        new Date(new Date(event.startDateTime).getTime() + 2 * 60 * 60 * 1000).toISOString()
      );

  const location = [event.venueName, venueAddress].filter(Boolean).join(', ');
  const description = [event.description ?? '', shareUrl].filter(Boolean).join('\n\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rasika.life//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    ...(description ? [`DESCRIPTION:${description.replace(/\n/g, '\\n')}`] : []),
    ...(location ? [`LOCATION:${location}`] : []),
    `URL:${shareUrl}`,
    `UID:${event.id}@rasika.life`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
      const { uploadUrl, posterUrl, posterOgUrl, posterUploadId } = await urlRes.json();

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
      if (posterOgUrl) updateForm.append('posterOgUrl', posterOgUrl);

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
      <h3 className="text-sm font-semibold" id="poster-uploader-label">
        Replace Poster
      </h3>
      <input
        type="file"
        accept="image/*"
        aria-labelledby="poster-uploader-label"
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

function RsvpButton({
  eventId,
  isLoggedIn,
  initialCount,
  initialIsGoing,
}: {
  eventId: string;
  isLoggedIn: boolean;
  initialCount: number;
  initialIsGoing: boolean;
}) {
  const fetcher = useFetcher<{ rsvp?: { isGoing: boolean; count: number } }>();

  const optimisticIsGoing =
    fetcher.formData?.get('intent') === 'toggleRsvp' ? !initialIsGoing : initialIsGoing;
  const optimisticCount =
    fetcher.formData?.get('intent') === 'toggleRsvp'
      ? initialCount + (initialIsGoing ? -1 : 1)
      : (fetcher.data?.rsvp?.count ?? initialCount);

  const displayCount = fetcher.data?.rsvp?.count ?? optimisticCount;
  const displayIsGoing = fetcher.data?.rsvp?.isGoing ?? optimisticIsGoing;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users aria-hidden="true" className="h-4 w-4" />
        {displayCount} {displayCount === 1 ? 'person' : 'people'} going
      </span>
      {isLoggedIn ? (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="toggleRsvp" />
          <Button
            type="submit"
            size="sm"
            variant={displayIsGoing ? 'default' : 'outline'}
            aria-pressed={displayIsGoing}
            disabled={fetcher.state !== 'idle'}
            className={displayIsGoing ? 'group' : ''}
          >
            {displayIsGoing ? (
              <>
                <span className="group-hover:hidden">Going ✓</span>
                <span className="hidden group-hover:inline">Can't make it</span>
              </>
            ) : (
              "I'm going"
            )}
          </Button>
        </fetcher.Form>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link to="/login">Sign in to RSVP</Link>
        </Button>
      )}
    </div>
  );
}

function AttendedButton({
  eventId,
  isLoggedIn,
  initialCount,
  initialIsAttended,
}: {
  eventId: string;
  isLoggedIn: boolean;
  initialCount: number;
  initialIsAttended: boolean;
}) {
  const fetcher = useFetcher<{ attended?: { isAttended: boolean; count: number } }>();

  const optimisticIsAttended =
    fetcher.formData?.get('intent') === 'toggleAttended' ? !initialIsAttended : initialIsAttended;
  const optimisticCount =
    fetcher.formData?.get('intent') === 'toggleAttended'
      ? initialCount + (initialIsAttended ? -1 : 1)
      : (fetcher.data?.attended?.count ?? initialCount);

  const displayCount = fetcher.data?.attended?.count ?? optimisticCount;
  const displayIsAttended = fetcher.data?.attended?.isAttended ?? optimisticIsAttended;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <NotebookPen aria-hidden="true" className="h-4 w-4" />
        {displayCount} {displayCount === 1 ? 'rasika' : 'rasikas'} attended
      </span>
      {isLoggedIn ? (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="toggleAttended" />
          <Button
            type="submit"
            size="sm"
            variant={displayIsAttended ? 'default' : 'outline'}
            aria-pressed={displayIsAttended}
            disabled={fetcher.state !== 'idle'}
          >
            {displayIsAttended ? 'I was here ✓' : 'I was here'}
          </Button>
        </fetcher.Form>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link to="/login">Sign in to log</Link>
        </Button>
      )}
      {displayIsAttended && (
        <Link to={`/my-concerts/${eventId}`} className="text-xs text-primary hover:underline">
          Add notes
        </Link>
      )}
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
    contact,
    relatedVenueEvents,
    relatedOrganiserEvents,
    rsvpCount,
    userIsGoing,
    isPast,
    userAttended,
    attendedCount,
    setlistCanonical,
    setlistUserOwn,
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
    contact?: ResolvedEventContact;
    relatedVenueEvents: RelatedEventItem[];
    relatedOrganiserEvents: RelatedEventItem[];
    rsvpCount: number;
    userIsGoing: boolean;
    isPast: boolean;
    userAttended: boolean;
    attendedCount: number;
    setlistCanonical: Array<{
      order: number;
      compositionId?: string;
      compositionTitle: string;
      ragaName?: string;
      talaName?: string;
      compositionType?: string;
      status: string;
      contributorCount: number;
      totalLoggersForEvent: number;
      publicNoteIds: string[];
    }>;
    setlistUserOwn: Array<{ order: number; compositionTitle: string }> | null;
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

  const googleCalendarUrl = buildGoogleCalendarUrl(event, venueAddress, shareUrl);

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
          {/* Description */}
          {event.description && (
            <section>
              <h2 className="text-base font-semibold mb-2">About</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </section>
          )}

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

          {/* Add to Calendar */}
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarPlus className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="no-ext-arrow text-sm text-primary hover:underline"
            >
              Add to Google Calendar
            </a>
            <span className="text-muted-foreground text-sm">·</span>
            <button
              type="button"
              onClick={() => downloadICS(event, venueAddress, shareUrl)}
              className="text-sm text-primary hover:underline"
            >
              Download .ics
            </button>
          </div>

          {/* RSVP / Attendance */}
          {isPast ? (
            <AttendedButton
              eventId={event.id}
              isLoggedIn={!!user}
              initialCount={attendedCount}
              initialIsAttended={userAttended}
            />
          ) : (
            <RsvpButton
              eventId={event.id}
              isLoggedIn={!!user}
              initialCount={rsvpCount}
              initialIsGoing={userIsGoing}
            />
          )}

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
                <Link key={tag} to={`/events/tags/${encodeURIComponent(tag)}`}>
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-accent transition-colors"
                  >
                    {tag}
                  </Badge>
                </Link>
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

      {/* Contact. Falls back to the organiser's own details when this poster printed none —
          see ~/lib/event-contact. Borrowed details say whose they are, because "call this
          number about this concert" and "this is the sabha's office line" are different
          promises and the reader is entitled to know which one is being made. */}
      {contact && (
        <section className="mt-6">
          <h2 className="text-base font-semibold mb-2">Contact</h2>
          <Card>
            <CardContent className="py-4 space-y-2">
              {contact.source === 'organiser' && event.organiserName && (
                <p className="text-sm text-muted-foreground">
                  General enquiries for {event.organiserName}, not this event.
                </p>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4" />
                  {contact.email}
                </a>
              )}
              {contact.website && (
                <a
                  href={contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-ext-arrow flex items-center gap-2 text-sm"
                >
                  <Globe className="h-4 w-4" />
                  {contact.website}
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

      {/* Setlist */}
      {isPast && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Setlist</h2>
            {user && (
              <Link
                to={`/my-concerts/${event.id}/edit`}
                className="text-sm text-primary hover:underline"
              >
                {setlistUserOwn && setlistUserOwn.length > 0
                  ? 'Edit your setlist'
                  : 'Add your setlist'}
              </Link>
            )}
          </div>

          {setlistCanonical.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No setlist logged yet.{' '}
              {user && (
                <Link to={`/my-concerts/${event.id}/edit`} className="text-primary hover:underline">
                  Log it
                </Link>
              )}
            </p>
          ) : (
            <>
              <ol className="space-y-1.5 mb-3">
                {setlistCanonical
                  .filter(row => row.status !== 'lowConfidence')
                  .map(row => (
                    <li key={row.order} className="flex items-start gap-3 text-sm">
                      <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">
                        {row.order + 1}.
                      </span>
                      <div className="min-w-0">
                        <span className="font-medium">{row.compositionTitle}</span>
                        {(row.ragaName || row.talaName || row.compositionType) && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {[row.ragaName, row.talaName, row.compositionType]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {row.publicNoteIds.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({row.publicNoteIds.length} note
                            {row.publicNoteIds.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
              </ol>
              {setlistCanonical.some(r => r.status === 'lowConfidence') && (
                <details className="text-sm">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Also reported (
                    {setlistCanonical.filter(r => r.status === 'lowConfidence').length})
                  </summary>
                  <ol className="space-y-1 mt-1 pl-4">
                    {setlistCanonical
                      .filter(r => r.status === 'lowConfidence')
                      .map(row => (
                        <li key={row.order} className="text-xs text-muted-foreground">
                          {row.compositionTitle}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Based on logs from {setlistCanonical[0]?.totalLoggersForEvent ?? 0} rasika
                {setlistCanonical[0]?.totalLoggersForEvent !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </section>
      )}

      {/* More events at venue */}
      {relatedVenueEvents.length > 0 && event.venueId && event.venueName && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">More events at {event.venueName}</h2>
            <Link
              to={generateVenueUrl(event.venueName, event.venueId)}
              className="text-sm text-primary"
            >
              View venue
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedVenueEvents.map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* More events by organiser */}
      {relatedOrganiserEvents.length > 0 && event.organiserId && event.organiserName && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">More events by {event.organiserName}</h2>
            <Link
              to={generateOrganiserUrl(event.organiserName, event.organiserId)}
              className="text-sm text-primary"
            >
              View organiser
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedOrganiserEvents.map(e => (
              <EventCard key={e.id} event={e} />
            ))}
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
